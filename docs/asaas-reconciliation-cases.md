# Asaas Sandbox — mandatory reconciliation scenarios

| Scenario | Expected decision |
| --- | --- |
| Confirmed payment, active subscription, matching plan and valid period | verified candidate |
| Pending payment | retry with backoff |
| Provider temporarily unavailable | retry with backoff |
| Eight failed attempts | rejected |
| Payment for a different subscription | rejected |
| Expired job lease | rejected without provider call |
| Invalid payment reference | rejected without provider call |
| Refunded or disputed payment | rejected |
| Expired billing period | rejected |
| Duplicate webhook delivery | one audit receipt / one queued job |
| Two workers claiming simultaneously | at most one lease |
| Worker crashes before finalization | lease recovery with idempotency |
| Delayed old event after renewal | no regression of newer entitlement |

**Not yet executed:** the last four cases require database integration and
Sandbox credentials. Do not enable payment or paid access until all pass.
