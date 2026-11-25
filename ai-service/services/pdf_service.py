
import os
import pymupdf


MAX_COMBINED_PAGES = 500


def extract_text_from_pdf(file_path):
    """Extract text from every page of one PDF file."""

    pages = []

    with pymupdf.open(file_path) as document:
        for page_number, page in enumerate(document, start=1):
            page_text = page.get_text()

            if page_text and page_text.strip():
                pages.append(
                    f"\n--- Page {page_number} ---\n{page_text}"
                )

    return "\n".join(pages).strip()


def extract_text_from_pdfs(file_paths, max_pages=MAX_COMBINED_PAGES):
    """
    Extract text from multiple PDFs.

    Returns:
        (combined_text, total_page_count)

    Raises:
        ValueError if the combined PDFs exceed the page limit.
    """

    if not file_paths:
        raise ValueError("At least one PDF file is required.")

    all_pages = []
    total_pages = 0

    for file_path in file_paths:

        filename = os.path.basename(file_path)

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
