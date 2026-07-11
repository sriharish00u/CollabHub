import os

SKIP_DIRS = {"venv", "__pycache__", ".git", "node_modules", ".opencode"}
SKIP_EXTS = {".pyc", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".map"}
MAX_FILE_SIZE = 500_000  # 500KB per file

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(PROJECT_ROOT, "code.md")


def collect_files():
    files = []
    for dirpath, dirnames, filenames in os.walk(PROJECT_ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in SKIP_EXTS:
                continue
            full_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(full_path, PROJECT_ROOT)
            if os.path.getsize(full_path) > MAX_FILE_SIZE:
                continue
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    content = f.read()
                files.append((rel_path, content))
            except (UnicodeDecodeError, PermissionError, OSError):
                continue
    files.sort(key=lambda x: x[0])
    return files


def generate_markdown(files):
    lines = ["# COLLABHUB - Full Codebase\n"]
    lines.append(f"Generated from {len(files)} files.\n")
    for rel_path, content in files:
        lines.append(f"## {rel_path}\n")
        lines.append(f"```{os.path.splitext(rel_path)[1].lstrip('.') or 'text'}")
        lines.append(content)
        lines.append("```\n")
    return "\n".join(lines)


def main():
    files = collect_files()
    md = generate_markdown(files)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"Generated {OUTPUT_FILE} with {len(files)} files.")


if __name__ == "__main__":
    main()
