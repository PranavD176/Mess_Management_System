"""
database.py — psycopg3 connection pool using DATABASE_URL from .env

psycopg3 (psycopg package) supports Python 3.13 with prebuilt binary wheels.
API differences from psycopg2:
  - Use psycopg.connect() and psycopg.ConnectionPool
  - RealDictRow is replaced by psycopg.rows.dict_row
  - Cursor results are plain dicts directly
"""
from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from config import DATABASE_URL

# Thread-safe connection pool
_pool = ConnectionPool(
    conninfo=DATABASE_URL + "?sslmode=require",
    min_size=1,
    max_size=10,
    open=True,
)


@contextmanager
def get_cursor():
    """Yield a dict-row cursor from a pooled connection; auto-commit on success."""
    with _pool.connection() as conn:
        with conn.transaction():
            with conn.cursor(row_factory=dict_row) as cur:
                yield cur
