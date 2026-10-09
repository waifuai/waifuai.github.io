"""Browser regression checks for real chat gestures inside sandboxed cards.

Run: python waifu-sprites/tests/test_player_card.py
Requires Playwright and its Chromium browser. All network requests are mocked.
"""
import json
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
            if request.get('stream'):
                self.calls.append(request)
                event = {'choices': [{'delta': {'content': '[happy] Mock reply received.'}}]}
                route.fulfill(content_type='text/event-stream', body='data: ' + json.dumps(event) + '\n\ndata: [DONE]\n\n')
            else:
                route.fulfill(content_type='application/json', body=json.dumps({'choices': [{'message': {'content': 'Test chat'}}]}))
        else:
            # Analytics, speech and other external services never reach production.
            route.fulfill(content_type='application/javascript', body='')

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

    def test_full_app(self):
        self.check_chat()

    def test_iframe_with_forms(self):
        self.check_chat('allow-scripts allow-same-origin allow-forms')

    def test_iframe_without_forms(self):
        self.check_chat('allow-scripts allow-same-origin')

    def test_iframe_without_forms_or_storage(self):
        self.check_chat('allow-scripts', blocked_storage=True)


if __name__ == '__main__':
    unittest.main()
