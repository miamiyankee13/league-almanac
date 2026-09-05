Phase 2.3 ownership evidence fix

Fixes a Sleeper trade edge case where an incoming replacement owner can accept
completed trades without appearing as transaction.creator.

The analyzer now:
- keeps direct creator activity as strongest evidence
- detects completed trade participation by the roster after the outgoing
  manager's last direct activity
- labels that evidence as indirect rather than pretending the incoming manager
  initiated the trade
- can suggest a midseason handoff window from that indirect evidence
- displays the indirect roster trade evidence in the reconciliation modal
