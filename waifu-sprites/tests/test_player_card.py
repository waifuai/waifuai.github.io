"""Browser regression checks for real chat gestures inside sandboxed cards.

Run: python waifu-sprites/tests/test_player_card.py
Requires Playwright and its Chromium browser. All network requests are mocked.
"""
import json
import base64
import io
import wave
import mimetypes
from pathlib import Path
import unittest
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
APP = 'https://sprites.test/waifu-sprites/'


class PlayerCardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 600, 'height': 600})
        self.context.set_default_timeout(6000)
        self.calls = []
        self.cloud_requests = []
        self.decision_requests = []
        self.tts_calls = []
        self.language_answer = {'choice_id': 'en-US', 'confidence': 0.95}
        self.picture_answer = None
        self.reply_text = '[happy] Mock reply received.'
        self.emotion_answer = {'choice_id': 'confused', 'confidence': 0.9}
        self.decision_status = 'ok'
        self.pending_emotion = None
        self.hold_emotion = False
        self.errors = []
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))

    def tearDown(self):
        self.context.close()

    def route(self, route):
        url = urlparse(route.request.url)
        if url.hostname == 'sprites.test':
            file = (ROOT / unquote(url.path).lstrip('/')).resolve()
            if file.is_dir():
                file = file / 'index.html'
            if file.is_relative_to(ROOT) and file.is_file():
                route.fulfill(content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream', body=file.read_bytes())
            else:
                route.fulfill(status=404)
        elif url.path.endswith('/chat/completions'):
            request = route.request.post_data_json
            self.cloud_requests.append({'path': url.path, 'headers': route.request.all_headers(), 'body': request})
            if request.get('stream'):
                self.calls.append(request)
                event = {'choices': [{'delta': {'content': self.reply_text}}]}
                route.fulfill(content_type='text/event-stream', body='data: ' + json.dumps(event) + '\n\ndata: [DONE]\n\n')
            else:
                content = 'DRAW: Aurora smiling in a sunny garden' if route.request.headers.get('x-waifu-purpose') == 'image_prompt' else 'Test chat'
                route.fulfill(content_type='application/json', body=json.dumps({'choices': [{'message': {'content': content}}]}))
        elif url.path == '/decisions':
            request = route.request.post_data_json
            self.decision_requests.append({'headers': route.request.all_headers(), 'body': request})
            if 'sprites_emotion_v1' in request['tasks'] and self.hold_emotion:
                self.pending_emotion = route
            else:
                self.fulfill_decision(route, request['tasks'])
        elif url.hostname == 'ottsy.weilbyte.dev':
            self.tts_calls.append(route.request.post_data_json)
            audio = io.BytesIO()
            with wave.open(audio, 'wb') as wav:
                wav.setparams((1, 2, 22050, 0, 'NONE', 'not compressed'))
                wav.writeframes(b'\0\0' * 2205)
            route.fulfill(headers={'access-control-allow-origin': '*'}, content_type='application/json',
                          body=json.dumps({'success': True, 'data': base64.b64encode(audio.getvalue()).decode()}))
        elif url.path == '/image':
            self.cloud_requests.append({'path': url.path, 'headers': route.request.all_headers()})
            route.fulfill(headers={'X-Image-Url': 'https://sprites.test/picture.png'}, body='')
        else:
            # Analytics, speech and other external services never reach production.
            route.fulfill(content_type='application/javascript', body='')

    def fulfill_decision(self, route, tasks):
        wants_picture = 'selfie' in route.request.post_data_json.get('state', {}).get('user_message', '').lower()
        answers = {task: (self.language_answer if task == 'sprites_tts_language_v1' else self.emotion_answer if task == 'sprites_emotion_v1'
                         else self.picture_answer or {'choice_id': 'draw' if wants_picture else 'none', 'confidence': 0.9}) for task in tasks}
        route.fulfill(content_type='application/json', body=json.dumps({
            'status': self.decision_status,
            'answers': answers if self.decision_status == 'ok' else {},
        }))

    def send_emotion_reply(self):
        self.page.goto(APP)
        self.page.evaluate('localStorage.clear()')
        self.page.reload()
        self.page.locator('#speakToggle').click()
        # Observe intended expressions independently of clip variation.
        self.page.evaluate("""() => {
            window.emotionCalls = [];
            const original = Sprites.setEmotion;
            Sprites.setEmotion = name => { emotionCalls.push(name); return original(name); };
            window.emotionFinished = 0;
            const ask = Chat.askDecisions;
            Chat.askDecisions = (tasks, state) => ask(tasks, state).finally(() => {
                if (tasks.includes('sprites_emotion_v1')) emotionFinished++;
            });
        }""")
        self.page.locator('#msgInput').fill('Explain this')
        self.page.locator('#sendBtn').click()
        self.page.locator('.msg.assistant:not(.typing)').wait_for()
        self.page.wait_for_function("() => !Chat.busy")

    def test_tagged_reply_requests_emotion_and_refines_expression(self):
        self.send_emotion_reply()
        self.page.wait_for_function("() => emotionCalls.includes('confused')")
        emotion = [r for r in self.decision_requests if r['body']['tasks'] == ['sprites_emotion_v1']]
        self.assertEqual(len(emotion), 1)
        self.assertEqual(emotion[0]['body']['state']['reply'], 'Mock reply received.')
        self.assertEqual(emotion[0]['body']['state']['user_message'], 'Explain this')
        chat = next(r for r in self.cloud_requests if r.get('body', {}).get('stream'))
        for header in ('x-session-id', 'x-visitor-id'):
            self.assertEqual(emotion[0]['headers'][header], chat['headers'][header])
        self.assertEqual(self.page.evaluate('emotionCalls'), ['happy', 'confused'])
        self.assertFalse(self.errors)

    def test_untagged_reply_still_requests_emotion(self):
        self.reply_text = 'Mock reply received.'
        self.send_emotion_reply()
        self.page.wait_for_function("() => emotionCalls.includes('confused')")
        self.assertEqual(self.page.evaluate('emotionCalls'), ['confused'])

    def test_decision_fallback_preserves_tag(self):
        for status, answer in [('unavailable', self.emotion_answer),
                               ('ok', {'choice_id': 'invalid', 'confidence': 0.9}),
                               ('ok', {'choice_id': 'happy', 'confidence': 0.9})]:
            with self.subTest(status=status, answer=answer):
                self.decision_status = status
                self.emotion_answer = answer
                self.send_emotion_reply()
                self.page.wait_for_function('() => emotionFinished === 1')
                self.assertEqual(self.page.evaluate('emotionCalls'), ['happy'])


    def test_low_confidence_emotion_winner_refines_expression(self):
        for confidence in [0, 0.1]:
            with self.subTest(confidence=confidence):
                self.emotion_answer = {'choice_id': 'confused', 'confidence': confidence}
                self.send_emotion_reply()
                self.page.wait_for_function('() => emotionFinished === 1')
                self.assertEqual(self.page.evaluate('emotionCalls'), ['happy', 'confused'])
                self.assertFalse(self.errors, self.errors)


    def test_late_decision_does_not_interrupt_typing(self):
        self.hold_emotion = True
        self.send_emotion_reply()
        self.page.wait_for_timeout(100)
        self.assertIsNotNone(self.pending_emotion)
        self.page.locator('#msgInput').fill('A new message')
        self.page.locator('#msgInput').dispatch_event('input')
        self.fulfill_decision(self.pending_emotion, ['sprites_emotion_v1'])
        self.page.wait_for_function('() => emotionFinished === 1')
        self.assertEqual(self.page.evaluate('emotionCalls'), ['happy'])
        self.assertEqual(self.page.evaluate('Sprites.current.name'), 'listening')

    def test_late_decision_does_not_interrupt_new_conversation(self):
        self.hold_emotion = True
        self.send_emotion_reply()
        self.page.wait_for_timeout(100)
        self.assertIsNotNone(self.pending_emotion)
        self.page.locator('#newBtn').click()
        self.fulfill_decision(self.pending_emotion, ['sprites_emotion_v1'])
        self.page.wait_for_function('() => emotionFinished === 1')
        self.assertEqual(self.page.evaluate('emotionCalls'), ['happy'])
        self.assertEqual(self.page.evaluate('Sprites.current.name'), 'idle')

    def test_late_decision_does_not_override_newer_reply(self):
        self.hold_emotion = True
        self.send_emotion_reply()
        self.page.wait_for_timeout(100)
        old = self.pending_emotion
        self.assertIsNotNone(old)
        self.page.locator('#msgInput').fill('Another turn')
        self.page.locator('#sendBtn').click()
        self.page.locator('.msg.assistant:not(.typing)').nth(1).wait_for()
        self.page.wait_for_function('() => !Chat.busy')
        self.fulfill_decision(old, ['sprites_emotion_v1'])
        self.page.wait_for_function('() => emotionFinished === 1')
        self.assertEqual(self.page.evaluate('emotionCalls'), ['happy', 'happy'])
        self.fulfill_decision(self.pending_emotion, ['sprites_emotion_v1'])
        self.page.wait_for_function('() => emotionFinished === 2')
        self.assertEqual(self.page.evaluate('emotionCalls'), ['happy', 'happy', 'confused'])

    def check_chat(self, sandbox=None, blocked_storage=False):
        if blocked_storage:
            self.context.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new DOMException('Blocked', 'SecurityError')}})")
        if sandbox is None:
            self.page.goto(APP)
            app = self.page
        else:
            self.context.route('https://host.test/', lambda r: r.fulfill(content_type='text/html', body=f'<iframe title="App" src="{APP}?embed=x" sandbox="{sandbox}" style="width:480px;height:480px"></iframe>'))
            self.page.goto('https://host.test/')
            app = self.page.frame_locator('iframe')
        field = app.locator('#msgInput')
        field.wait_for()
        self.assertEqual(len(self.calls), 0, 'No inference until a user sends a message')
        app.locator('#speakToggle').click()
        # A starter button is the known working path reported by the user.
        app.locator('.starters button').first.click()
        app.locator('.msg.assistant:not(.typing)').filter(has_text='Mock reply received.').wait_for()
        self.assertEqual(len(self.calls), 1)

        # Physical input and click: do not dispatch submit or call requestSubmit.
        field.click()
        field.press_sequentially('Send with button')
        self.assertEqual(field.input_value(), 'Send with button')
        app.locator('#sendBtn').click()
        app.locator('.msg.assistant:not(.typing)').nth(1).wait_for()
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(self.calls[-1]['messages'][-1]['content'], 'Send with button')
        self.assertEqual(field.input_value(), '')

        # Enter while an IME is composing must not prematurely send the text.
        field.fill('Send with Enter')
        field.dispatch_event('keydown', {'key': 'Enter', 'isComposing': True})
        field.dispatch_event('keydown', {'key': 'Enter', 'keyCode': 229})
        self.assertEqual(field.input_value(), 'Send with Enter')
        self.assertEqual(len(self.calls), 2)
        field.press('Enter')
        app.locator('.msg.assistant:not(.typing)').nth(2).wait_for()
        self.assertEqual(len(self.calls), 3, 'Enter must send exactly once')
        self.assertEqual(self.calls[-1]['messages'][-1]['content'], 'Send with Enter')
        self.assertEqual(field.input_value(), '')
        app.locator('#sendBtn').click()
        field.press('Enter')
        self.assertEqual(len(self.calls), 3, 'Empty messages must not send')
        self.assertFalse(self.errors)

    def test_memory_checkpoint_and_archive_survive_reload(self):
        self.page.goto(APP)
        conversation = self.page.evaluate('''() => {
            Chat.newConversation();
            Chat.messages.push({id: 'long-source', role: 'user', content: '日本語😀\\n'.repeat(12000)},
                ...Array.from({length: 9}, (_, i) => ({id: 'tail-' + i, role: i % 2 ? 'user' : 'assistant', content: 'Tail ' + i})));
            localStorage.setItem('ws_conv_' + Chat.convId, JSON.stringify(Chat.messages));
            return Chat.convId;
        }''')
        self.assertTrue(self.page.evaluate('Chat.summarize(true)'))
        self.assertTrue(self.page.evaluate('Chat.memoryPending'))
        self.page.reload()
        self.page.evaluate('(id) => Chat.openConversation(id)', conversation)
        self.assertTrue(self.page.evaluate('Chat.memoryPending'))
        for _ in range(8):
            if not self.page.evaluate('Chat.memoryPending'):
                break
            self.assertTrue(self.page.evaluate('Chat.summarize(true)'))
        self.assertFalse(self.page.evaluate('Chat.memoryPending'))
        self.assertEqual(self.page.evaluate('Chat.messages.length'), 10)
        self.assertEqual(self.page.evaluate('Chat.messages[0].id'), 'long-source')
        self.assertEqual(self.page.evaluate('Chat.unsummarizedStart()'), 6)
        summaries = [c['body'] for c in self.cloud_requests if c['headers'].get('x-waifu-purpose') == 'summary']
        self.assertGreater(len(summaries), 1)
        for request in summaries:
            self.assertLessEqual(len(json.dumps(request, ensure_ascii=False, separators=(',', ':')).encode()), 262144)
            self.assertEqual(request['context_budget_version'], 1)
        self.assertFalse(self.errors, self.errors)

    def test_manual_summary_size_feedback_keeps_saved_memory(self):
        self.page.goto(APP)
        self.page.evaluate("Chat.newConversation(); Chat.setSummary('Original notes')")
        self.page.locator('#settingsBtn').click()
        field = self.page.locator('#summaryText')
        self.assertIn('14 / 32768 bytes', self.page.locator('#summarySizeStatus').inner_text())
        field.fill('😀' * 9000)
        self.assertIn('36000 / 32768 bytes', self.page.locator('#summarySizeStatus').inner_text())
        field.dispatch_event('change')
        self.assertEqual(self.page.evaluate('Chat.summary'), 'Original notes')
        self.assertEqual(field.input_value(), 'Original notes')
        self.assertIn('32 KiB', self.page.locator('#summarySizeStatus').inner_text())
        self.assertFalse(self.errors, self.errors)

    def test_full_app(self):
        self.check_chat()

    def test_iframe_with_forms(self):
        self.check_chat('allow-scripts allow-same-origin allow-forms')

    def test_iframe_without_forms(self):
        self.check_chat('allow-scripts allow-same-origin')

    def test_iframe_without_forms_or_storage(self):
        self.check_chat('allow-scripts', blocked_storage=True)

    def check_picture_identity(self, sandbox=None):
        if sandbox is None:
            self.page.goto(APP)
            app = self.page
        else:
            self.context.route('https://host.test/', lambda r: r.fulfill(content_type='text/html', body=f'<iframe src="{APP}?embed=x" sandbox="{sandbox}"></iframe>'))
            self.page.goto('https://host.test/')
            app = self.page.frame_locator('iframe')
        app.locator('#speakToggle').click()
        app.locator('#msgInput').fill('Send me a selfie')
        app.locator('#sendBtn').click()
        app.locator('.msg.assistant:not(.typing)').filter(has_text='Mock reply received.').wait_for()
        app.locator('.msg img').wait_for()
        chat = next(r for r in self.cloud_requests if r.get('body', {}).get('stream'))
        prompt = next(r for r in self.cloud_requests if r['headers'].get('x-waifu-purpose') == 'image_prompt')
        image = next(r for r in self.cloud_requests if r['path'] == '/image')
        for header in ('x-session-id', 'x-visitor-id'):
            self.assertTrue(chat['headers'].get(header))
            self.assertEqual(prompt['headers'].get(header), chat['headers'][header])
            self.assertEqual(image['headers'].get(header), chat['headers'][header])
        self.assertEqual(prompt['body']['client_settings']['app'], 'waifu-sprites')
        self.assertFalse(self.errors)

    def test_zero_confidence_picture_actions_honor_choices(self):
        self.page.goto(APP)
        self.picture_answer = {'choice_id': 'none', 'confidence': 0}
        self.assertIsNone(self.page.evaluate("Pictures.decide('Send me a selfie', '')"))
        self.assertFalse(self.cloud_requests)
        self.picture_answer = {'choice_id': 'draw', 'confidence': 0}
        self.assertIn('garden', self.page.evaluate("Pictures.decide('Send me a selfie', '')"))
        self.assertEqual(len(self.cloud_requests), 1)
        prompt = self.cloud_requests[0]['body']['messages'][0]['content']
        self.assertIn('approved picture request', prompt)
        self.assertNotIn('NONE', prompt)
        self.assertFalse(self.errors, self.errors)

    def test_picture_calls_share_chat_identity(self):
        self.check_picture_identity()

    def test_embedded_picture_calls_share_chat_identity(self):
        self.check_picture_identity('allow-scripts allow-same-origin')


    def test_tts_uncertain_reply_shares_emotion_request_and_replay_cache(self):
        self.page.goto(APP)
        self.reply_text = '[happy] *waves gently* Kimi no koe ga yasashikute kokoro ga atatakai.'
        self.language_answer = {'choice_id': 'ja-JP', 'confidence': 0}
        self.page.locator('#msgInput').fill('Please read this')
        self.page.locator('#sendBtn').click()
        self.page.wait_for_function('!Chat.busy && !Speech.speaking')
        self.assertTrue(self.tts_calls)
        self.assertEqual(self.tts_calls[0]['voice'], 'jp_003')
        requests = [r['body'] for r in self.decision_requests if 'sprites_tts_language_v1' in r['body']['tasks']]
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0]['tasks'], ['sprites_emotion_v1', 'sprites_tts_language_v1'])
        self.assertFalse(requests[0]['state']['spoken_reply'].startswith('*'))
        before = len(self.decision_requests)
        self.page.evaluate('Speech.speak(Chat.lastReply(), {force: true})')
        self.assertEqual(len(self.decision_requests), before)
        self.assertEqual(self.tts_calls[-1]['voice'], 'jp_003')
        self.assertFalse(self.errors)

    def test_tts_clear_french_and_spanish_are_local(self):
        self.page.goto(APP)
        for text, voice in [('Bonjour, je suis contente de te voir.', 'fr_001'), ('Hola, gracias!', 'es_002')]:
            self.reply_text = '[happy] ' + text
            self.page.locator('#msgInput').fill('Read this reply')
            self.page.locator('#sendBtn').click()
            self.page.wait_for_function('!Chat.busy && !Speech.speaking')
            self.assertTrue(self.tts_calls)
            self.assertEqual(self.tts_calls[-1]['voice'], voice)
        self.assertFalse(any('sprites_tts_language_v1' in r['body']['tasks'] for r in self.decision_requests))
        self.assertFalse(self.errors)

    def test_tts_muted_and_auto_language_off_do_not_add_language_tasks(self):
        self.page.goto(APP)
        self.page.locator('#speakToggle').click()
        self.reply_text = '[happy] Kimi no koe ga yasashikute kokoro ga atatakai.'
        self.page.locator('#msgInput').fill('Read this reply')
        self.page.locator('#sendBtn').click()
        self.page.wait_for_function('!Chat.busy')
        self.assertFalse(self.tts_calls)
        self.page.locator('#speakToggle').click()
        self.page.evaluate('Speech.settings.autoLang = false')
        self.page.locator('#msgInput').fill('Read it again')
        self.page.locator('#sendBtn').click()
        self.page.wait_for_function('!Chat.busy && !Speech.speaking')
        self.assertEqual(self.tts_calls[-1]['voice'], 'en_us_001')
        self.assertFalse(any('sprites_tts_language_v1' in r['body']['tasks'] for r in self.decision_requests))
        self.assertFalse(self.errors)



    def test_long_reply_preserves_emotional_ending_in_decision_request(self):
        self.reply_text = '[happy] Opening. ' + 'x' * 5000 + ' I am thrilled!'
        self.page.goto(APP)
        self.page.locator('#speakToggle').click()
        self.page.locator('#msgInput').fill('Hello')
        with self.page.expect_request('**/decisions') as captured:
            self.page.locator('#sendBtn').click()
        state = captured.value.post_data_json['state']
        self.assertLessEqual(len(state['reply']), 4096)
        self.assertTrue(state['reply'].startswith('Opening. '))
        self.assertTrue(state['reply'].endswith('I am thrilled!'))
        self.assertIn('[...]', state['reply'])
        self.assertFalse(self.errors, self.errors)


if __name__ == '__main__':
    unittest.main()
