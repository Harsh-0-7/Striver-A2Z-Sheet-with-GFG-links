#!/usr/bin/env python3
import re
import json
from html.parser import HTMLParser


def norm_label(label: str) -> str:
    # Normalize header labels to camelCase keys
    label = (label or "").strip()
    label = re.sub(r"\s+", " ", label)
    # Common mappings
    mapping = {
        "": "checkbox",
        "topic/article": "topicArticle",
        "topic": "topic",
        "article": "article",
        "gfg": "gfg",
        "leetcode": "leetcode",
        "solution": "solution",
    }
    key = mapping.get(label.lower())
    if key:
        return key
    # generic camelCase conversion
    parts = re.split(r"[^a-zA-Z0-9]+", label)
    parts = [p for p in parts if p]
    if not parts:
        return "field"
    key = parts[0].lower() + "".join(p.capitalize() for p in parts[1:])
    return key


class A2ZParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        # details stack: entries have keys step, substep, stepTitle, substepTitle
        self.details_stack = []
        # summary parsing
        self.in_summary = False
        self.summary_text = []
        self.in_bold = False
        self.summary_bold_text = []

        # table parsing
        self.in_table = False
        self.in_thead = False
        self.in_tbody = False
        self.in_tr = False
        self.current_row_is_header = False
        self.current_cell_index = -1
        self.in_cell = False
        self.current_cell_text = []
        self.current_cell_links = []
        self.current_row_cells = []  # list of dicts: {text, links, checkboxId}
        self.current_table_headers = None  # list of header labels

        # row-level
        self.current_row_checkbox_id = None
        self.in_checkbox_input = False

        # results
        self.items = []

        # ignore stacks
        self.ignore_tag = None

    # Helpers to get current context
    def current_context(self):
        step = None
        substep = None
        stepTitle = None
        substepTitle = None
        for entry in self.details_stack:
            if entry.get("step") is not None and entry.get("substep") is None:
                step = entry.get("step")
                stepTitle = entry.get("stepTitle")
            if entry.get("substep") is not None:
                # Deepest substep in stack overrides
                step = entry.get("step")
                stepTitle = entry.get("stepTitle", stepTitle)
                substep = entry.get("substep")
                substepTitle = entry.get("substepTitle")
        return step, substep, stepTitle, substepTitle

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.ignore_tag = tag
            return
        attrs_dict = dict(attrs)
        if tag == "details":
            # Push placeholder; the following summary will set metadata
            self.details_stack.append({})
        elif tag == "summary":
            self.in_summary = True
            self.summary_text = []
            self.summary_bold_text = []
        elif self.in_summary and tag == "b":
            self.in_bold = True
        elif tag == "table":
            self.in_table = True
            self.current_table_headers = None
        elif tag == "thead":
            self.in_thead = True
        elif tag == "tbody":
            self.in_tbody = True
        elif tag == "tr":
            self.in_tr = True
            self.current_row_is_header = False
            self.current_row_cells = []
            self.current_cell_index = -1
            self.current_row_checkbox_id = None
            self._row_th_count = 0
            self._row_has_checkbox = False
        elif tag in ("th", "td") and self.in_tr:
            self.in_cell = True
            self.current_cell_index += 1
            self.current_cell_text = []
            self.current_cell_links = []
            if tag == "th":
                # Count how many th cells are in this row; do not immediately mark as header.
                self._row_th_count += 1
        elif tag == "a" and self.in_cell:
            href = attrs_dict.get("href")
            if href:
                self.current_cell_links.append(href)
        elif tag == "input" and self.in_cell:
            if attrs_dict.get("type") == "checkbox":
                cid = attrs_dict.get("id")
                if cid:
                    self.current_row_checkbox_id = cid
                self._row_has_checkbox = True

    def handle_endtag(self, tag):
        if tag == self.ignore_tag:
            self.ignore_tag = None
            return
        if tag == "summary":
            # Parse summary content and assign to top details entry
            btxt = "".join(self.summary_bold_text).strip()
            txt = "".join(self.summary_text).strip()
            # Extract after colon for title
            title = txt
            if ":" in title:
                # Keep the part after the first ':'
                title = title.split(":", 1)[1].strip()
            m = re.search(r"Step\s+(\d+)(?:\.(\d+))?", btxt, re.I)
            entry = self.details_stack[-1] if self.details_stack else None
            if m and entry is not None:
                step_num = int(m.group(1))
                substep_num = int(m.group(2)) if m.group(2) else None
                # Find nearest parent step title if needed
                if substep_num is None:
                    entry.update({
                        "step": step_num,
                        "substep": None,
                        "stepTitle": title or None,
                    })
                else:
                    # For substep, inherit step title from parent if exists
                    parent_step_title = None
                    for e in reversed(self.details_stack[:-1]):
                        if e.get("step") == step_num and e.get("substep") is None:
                            parent_step_title = e.get("stepTitle")
                            break
                    entry.update({
                        "step": step_num,
                        "substep": substep_num,
                        "stepTitle": parent_step_title,
                        "substepTitle": title or None,
                    })
            # reset summary flags
            self.in_summary = False
            self.in_bold = False
            self.summary_text = []
            self.summary_bold_text = []
        elif tag == "b" and self.in_summary:
            self.in_bold = False
        elif tag in ("th", "td") and self.in_tr and self.in_cell:
            # finalize cell
            text = "".join(self.current_cell_text).strip()
            self.current_row_cells.append({
                "text": re.sub(r"\s+", " ", text),
                "links": list(self.current_cell_links),
            })
            self.in_cell = False
            self.current_cell_text = []
            self.current_cell_links = []
        elif tag == "tr" and self.in_tr:
            # finalize row
            # Decide if this row is a header:
            # - If inside thead, it's header.
            # - Else, if headers not set yet and row has >=2 th cells and no checkbox, assume header.
            is_header = self.in_thead or (
                (self.current_table_headers is None) and (self._row_th_count >= 2) and (not self._row_has_checkbox)
            )

            if is_header:
                # Build headers list
                labels = []
                for cell in self.current_row_cells:
                    labels.append(cell["text"])
                self.current_table_headers = labels
            else:
                # Data row -> map to item object
                headers = self.current_table_headers or []
                row_obj = {}
                # Context
                step, substep, stepTitle, substepTitle = self.current_context()
                row_obj["step"] = step
                row_obj["substep"] = substep
                if stepTitle:
                    row_obj["stepTitle"] = stepTitle
                if substepTitle:
                    row_obj["substepTitle"] = substepTitle
                if self.current_row_checkbox_id:
                    row_obj["checkboxId"] = self.current_row_checkbox_id
                # Map cells
                for idx, cell in enumerate(self.current_row_cells):
                    label = headers[idx] if idx < len(headers) else f"col{idx}"
                    key = norm_label(label)
                    text = cell["text"]
                    link = cell["links"][0] if cell["links"] else None
                    # Special handling for Topic/Article
                    if key in ("topicArticle", "topic", "article"):
                        # Store title text
                        if text:
                            row_obj["title"] = text
                        if link:
                            # Only set article if looks like a page link
                            row_obj["article"] = link
                    elif key == "checkbox":
                        # Already captured checkboxId; ignore text
                        pass
                    else:
                        # For link-based columns, prefer link; else text
                        if link:
                            row_obj[key] = link
                        elif text:
                            row_obj[key + "Text"] = text
                # If no article but title cell contains an <a> later cells? skip
                self.items.append(row_obj)

            # reset row
            self.in_tr = False
            self.current_row_is_header = False
            self.current_row_cells = []
            self.current_cell_index = -1
            self.current_row_checkbox_id = None
            self._row_th_count = 0
            self._row_has_checkbox = False
        elif tag == "thead":
            self.in_thead = False
        elif tag == "tbody":
            self.in_tbody = False
        elif tag == "table":
            self.in_table = False
            self.current_table_headers = None
        elif tag == "details":
            if self.details_stack:
                self.details_stack.pop()

    def handle_data(self, data):
        if self.ignore_tag:
            return
        if self.in_summary:
            if self.in_bold:
                self.summary_bold_text.append(data)
            else:
                self.summary_text.append(data)
        if self.in_cell:
            self.current_cell_text.append(data)


def main():
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[1]
    html_path = root / "index.html"
    out_path = root / "data.global.js"
    html = html_path.read_text(encoding="utf-8", errors="ignore")
    parser = A2ZParser()
    parser.feed(html)
    items = parser.items
    # Post-process: clean up None steps/rows without meaningful content
    filtered = []
    for it in items:
        # Skip rows that don't have a title and no links at all
        has_link = any(k in it for k in ("gfg", "leetcode", "solution", "article"))
        if not it.get("title") and not has_link:
            continue
        filtered.append(it)

    # Write JS as export const data = [...];
    # Ensure stable ordering of keys
    def sort_keys(d):
        order = [
            "step", "substep", "stepTitle", "substepTitle", "checkboxId",
            "title", "article", "gfg", "solution", "leetcode",
        ]
        keys = list(d.keys())
        keys_sorted = [k for k in order if k in d] + [k for k in keys if k not in order]
        return {k: d[k] for k in keys_sorted}

    js_array = json.dumps([sort_keys(it) for it in filtered], ensure_ascii=False, indent=2)
    out = "window.data = " + js_array + ";\n"
    out_path.write_text(out, encoding="utf-8")
    print(f"Extracted {len(filtered)} items to {out_path}")


if __name__ == "__main__":
    main()
