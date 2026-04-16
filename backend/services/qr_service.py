"""
services/qr_service.py — Generate QR code PNG as base64 string
"""
import io
import base64
import qrcode
from qrcode.image.pure import PyPNGImage


def generate_qr_base64(student_id: int) -> str:
    """
    Encode only the student's integer ID into a QR code.
    Returns a base64-encoded PNG string (data URI ready).
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(str(student_id))
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    encoded = base64.b64encode(buffer.read()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"
