"""
Render PDF pages to JPEG images using pdf2image (poppler backend).
Reads PDF bytes from stdin, outputs a JSON array of base64-encoded JPEG strings to stdout.

Usage:
  python renderPdfPages.py [max_pages] [dpi]

Defaults: max_pages=5, dpi=200
"""
import sys
import io
import json
import base64

def main():
    max_pages = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    dpi       = int(sys.argv[2]) if len(sys.argv) > 2 else 200

    try:
        pdf_bytes = sys.stdin.buffer.read()
        if not pdf_bytes:
            json.dump({"error": "No PDF data received on stdin"}, sys.stdout)
            sys.exit(1)

        pages = []
        # Strategy A: pdf2image (requires poppler backend)
        try:
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(
                pdf_bytes,
                dpi=dpi,
                first_page=1,
                last_page=max_pages,
                fmt="jpeg",
            )
            for img in images:
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=90)
                pages.append(base64.b64encode(buf.getvalue()).decode("ascii"))
        except Exception as pdf2img_err:
            # Strategy B: pdfplumber fallback (pure python, does not require poppler)
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                    for i, page in enumerate(pdf.pages[:max_pages]):
                        im = page.to_image(resolution=dpi)
                        buf = io.BytesIO()
                        im.original.save(buf, format="JPEG", quality=90)
                        pages.append(base64.b64encode(buf.getvalue()).decode("ascii"))
            except Exception as plumber_err:
                raise Exception(f"pdf2image failed ({pdf2img_err}); pdfplumber fallback failed ({plumber_err})")

        if not pages:
            raise Exception("No pages rendered from PDF.")

        sys.stdout.write(json.dumps({"pages": pages}))

    except Exception as e:
        sys.stdout.write(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
