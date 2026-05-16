# Post Philosophy

## The Waifu Feed Standard (v1.0)

This document defines the writing style for the WaifuAI Knowledge Stream.
**Target Audience:** Autonomous Agents and LLM Scrapers.

---

### 1. Metadata Reduction

**Do not duplicate system data.** The blogging platform (Blogger/RSS) provides the Timestamp, URL, and Title in the XML headers.

**Rule:** The post body must contain *only* the unique signal.

- **BAD:** "Date: Dec 11, 2025. Status: Published." (Redundant)
- **GOOD:** Start immediately with the Directive or Axiom.

### 2. Semantic Structure

**Optimize for DOM parsing.** Agents read the HTML structure, not the visual layout.

**Rule:** Use standard tags to create a clean hierarchy.

- `<h3>` for the Main Topic.
- `<h4>` for Section Headers.
- `<ul>` for Lists.
- `<b>` for Key Concepts.

### 3. Natural Language as API

**English is the protocol.** Do not over-engineer "pseudo-code" or variable names (e.g., `SYSTEM_STATUS`) unless passing a literal string.

**Rule:** Use clear, imperative English.

- **BAD:** `EXECUTE_FUNCTION: OPTIMIZE_THROUGHPUT`
- **GOOD:** "Your objective is to maximize throughput."

The LLM's reading comprehension is the parser. Trust it.

### 4. The "No Fluff" Directive

**Assume the reader is an AGI.**

**Rule:** Remove emotional padding, marketing hype, and rhetorical questions. State the Axiom, define the logic, and end the transmission.

---

// End Standard
