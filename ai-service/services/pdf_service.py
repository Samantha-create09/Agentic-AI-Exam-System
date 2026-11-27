
import os
import pymupdf


MAX_COMBINED_PAGES = 500


def _resolve_file_entry(entry, fallback_name=None):
    """Resolve a path or (path, original_name) / dict entry into (path, display_name)."""
    if isinstance(entry, dict):
        file_path = entry["path"]
        display_name = entry.get("filename") or entry.get("name") or fallback_name
    elif isinstance(entry, (tuple, list)):
        file_path = entry[0]
        display_name = entry[1] if len(entry) > 1 else fallback_name
    else:
        file_path = entry
        display_name = fallback_name

    clean_name = os.path.basename(display_name or file_path) or "upload.pdf"
    return file_path, clean_name


def extract_text_from_pdf(file_path, display_name=None):
    """Extract text from every page of one PDF file."""

    pages = []
    clean_name = os.path.basename(display_name) if display_name else None

    with pymupdf.open(file_path) as document:
        for page_number, page in enumerate(document, start=1):
            page_text = page.get_text()

            if page_text and page_text.strip():
                header = (
                    f"--- File: {clean_name} | Page {page_number} ---"
                    if clean_name
                    else f"--- Page {page_number} ---"
                )
                pages.append(f"\n{header}\n{page_text}")

    return "\n".join(pages).strip()


def extract_text_from_pdfs(file_paths, max_pages=MAX_COMBINED_PAGES, display_names=None):
    """
    Extract text from multiple PDFs.

    Args:
        file_paths: Sequence of file paths, (path, original_name) tuples, or
            {"path": ..., "filename": ...} dicts.
        max_pages: Maximum combined pages allowed across all PDFs.
        display_names: Optional sequence of original filenames aligned with file_paths.

    Returns:
        (combined_text, total_page_count)

    Raises:
        ValueError if the combined PDFs exceed the page limit.
    """

    if not file_paths:
        raise ValueError("At least one PDF file is required.")

    all_pages = []
    total_pages = 0

    for index, entry in enumerate(file_paths):
        fallback_name = (
            display_names[index]
            if display_names and index < len(display_names)
            else None
        )
        file_path, filename = _resolve_file_entry(entry, fallback_name)

        with pymupdf.open(file_path) as document:

            document_page_count = len(document)

            if total_pages + document_page_count > max_pages:
                raise ValueError(
                    f"The uploaded PDFs contain more than "
                    f"{max_pages} pages combined. "
                    f"Please reduce the number of pages."
                )

            total_pages += document_page_count

            for page_number, page in enumerate(document, start=1):

                page_text = page.get_text()

                if page_text and page_text.strip():

                    all_pages.append(
                        f"\n--- File: {filename} | "
                        f"Page {page_number} ---\n{page_text}"
                    )

    combined_text = "\n".join(all_pages).strip()

    return combined_text, total_pages
