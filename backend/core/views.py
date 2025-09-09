from django.db import connection
from django.http import JsonResponse

def health(request):
    ok_db = True
    try:
        connection.ensure_connection()
    except Exception:
        ok_db = False
    return JsonResponse({"db": "ok" if ok_db else "down"}, status=200 if ok_db else 503)

