with open('docs/GYM_RETENTION_TEST_PLAN.md', 'r', encoding='utf-8') as f:
    c = f.read()
# Simple string replace - try both apostrophe variants
c = c.replace("idempotent.it's idempotent.", "idempotent.")
c = c.replace("idempotent.it\u2019s idempotent.", "idempotent.")
with open('docs/GYM_RETENTION_TEST_PLAN.md', 'w', encoding='utf-8') as f:
    f.write(c)
print("Done")
