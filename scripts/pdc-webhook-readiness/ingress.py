"""Prepare one exact HTTPS POST exception. No deployment occurs in preparation."""
import hashlib
import re


def digest(data):
    return hashlib.sha256(data).hexdigest()


def block(port):
    assert isinstance(port, int) and 1024 <= port <= 65535
    return '''        # Inbound PDC tracking only; outbound provider gates remain closed.
        @pdc_webhook {
            protocol https
            method POST
            path /api/webhooks/pdc
        }
        header @pdc_webhook >Cache-Control "no-store"
        request_body @pdc_webhook {
            max_size 8192
        }
        reverse_proxy @pdc_webhook 127.0.0.1:PORT {
            lb_try_duration 0
            transport http {
                dial_timeout 2s
                response_header_timeout 8s
            }
        }
'''.replace('PORT', str(port))


def patch(original, port):
    anchor = '        @commerce path '
    assert original.count(anchor) == 1 and '@pdc_webhook' not in original
    assert '/api/webhooks /api/webhooks/*' in original
    # The reviewed route must bind the same existing loopback application.
    assert f'reverse_proxy 127.0.0.1:{port} {{' in original
    addition = block(port)
    candidate = original.replace(anchor, addition + anchor, 1)
    assert candidate.replace(addition, '', 1) == original
    return candidate
