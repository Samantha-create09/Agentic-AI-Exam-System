import fitz


def extract_text_from_pdf(file_path):
    """
    Extract all readable text from a PDF.
    """

    document = fitz.open(file_path)

    pages = []

    for page_number, page in enumerate(document):

        text = page.get_text()

        if text:
            pages.append(
                f"\n--- Page {page_number + 1} ---\n{text}"
            )

    document.close()

    return "\n".join(pages)