"""Exercise the migration's grouping expression with SQLite (no database writes).

Run: python3 supabase/tests/customer_summary_grouping.test.py
This checks grouping behavior, not PostgreSQL migration compatibility.
"""
import pathlib
import re
import sqlite3
import unittest


class CustomerSummaryGroupingTest(unittest.TestCase):
    def setUp(self):
        migrations = pathlib.Path(__file__).resolve().parents[1] / "migrations"
        definitions = [
            path.read_text() for path in sorted(migrations.glob("*.sql"))
            if re.search(r"CREATE (?:OR REPLACE )?VIEW public.customer_summary AS", path.read_text())
        ]
        expression = re.search(r"GROUP BY (CASE[\s\S]*?END)", definitions[-1]).group(1)
        self.expression = expression.replace("::text", "")
        self.db = sqlite3.connect(":memory:")
        self.db.create_function("BTRIM", 1, lambda value: value.strip(" ") if value is not None else None)
        self.db.execute("""CREATE TABLE orders (
            id TEXT, user_id TEXT, customer_email TEXT, customer_phone TEXT,
            customer_name TEXT, order_channel TEXT, total REAL
        )""")
        self.addCleanup(self.db.close)

    def add(self, id, user=None, email="", phone="", name="INSTORE", channel="instore", total=10):
        self.db.execute("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (id, user, email, phone, name, channel, total))

    def groups(self):
        return self.db.execute(
            f"SELECT COUNT(*), SUM(total) FROM orders GROUP BY {self.expression} ORDER BY COUNT(*) DESC"
        ).fetchall()

    def test_anonymous_instore_is_one_customer(self):
        self.add("cash", total=15)
        self.add("smartpay", name=" instore ", email=None, phone=None, total=25)
        self.add("card", email=" ", phone=" ", total=30)
        self.assertEqual(self.groups(), [(3, 70)])

    def test_marketplace_profiles_stay_separate_and_reuse_identity(self):
        self.add("uber-1", user="uber-customer", channel="third_party")
        self.add("uber-2", user="uber-customer", channel="third_party")
        self.add("dd-1", user="dd-customer", channel="third_party")
        self.assertEqual(self.groups(), [(2, 20), (1, 10)])

    def test_unknown_marketplace_customers_do_not_merge_with_instore(self):
        self.add("cash")
        self.add("uber-1", channel="third_party")
        self.add("uber-2", channel="third_party")
        self.assertEqual(self.groups(), [(1, 10)] * 3)

    def test_real_contacts_and_named_guests_do_not_merge_into_instore(self):
        self.add("cash")
        self.add("phone", phone="0400000000")
        self.add("email", email="customer@example.invalid")
        self.add("named", name="Alice")
        self.assertEqual(self.groups(), [(1, 10)] * 4)

    def test_claimed_order_moves_to_real_customer(self):
        self.add("cash")
        self.add("claimed")
        self.assertEqual(self.groups(), [(2, 20)])
        self.db.execute("UPDATE orders SET user_id = 'real-customer' WHERE id = 'claimed'")
        self.assertEqual(self.groups(), [(1, 10), (1, 10)])


if __name__ == "__main__":
    unittest.main()
