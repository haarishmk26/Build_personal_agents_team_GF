# Personal Agents — Product Requirements Document

## Status

Draft — defining the first end-to-end workflow.

## Product vision

Personal Agents reduces the repetitive administrative work that follows ordinary life events. A person states an outcome in plain language; the product coordinates the necessary steps across the services they choose, keeps them informed, and asks for help only when human review, authentication, or a decision is needed.

## Problem

A single real-world change often requires repeating nearly identical work across many unrelated websites. For example, after moving, a person may update their USPS address and then separately update the address held by their bank, gym, and ecommerce account. The work is tedious, error-prone, and easy to leave incomplete.

## Initial use case: address-change orchestration

A user asks the agent to update their address after a move. The first workflow coordinates these destinations:

1. USPS address change
2. One selected bank
3. One selected gym or fitness provider
4. One selected ecommerce website

The agent treats this as one tracked task, while making each destination's progress visible.

## Goals

- Let a user create one address-change request and track all selected destinations in one place.
- Collect the new address once and reuse it only with the user's authorization.
- Guide or automate the destination-specific steps where permitted.
- Clearly surface any required sign-in, MFA, fee, confirmation, or manual action.
- Produce an auditable outcome for every destination: completed, awaiting user, failed, or skipped.
- Establish reusable workflow patterns for later life-admin tasks.

## Non-goals for the first release

- Supporting every financial institution, gym, or retailer.
- Making irreversible changes without a user confirmation at the relevant step.
- Storing bank credentials or bypassing MFA, CAPTCHAs, or service terms.
- Handling postal forwarding disputes, legal identity changes, or address verification edge cases.
- Fully autonomous action on services that do not permit it.

## Primary user journey

1. The user selects **Change my address**.
2. The user provides a new address, effective date, and previous address when required.
3. The user chooses the connected destinations: USPS, a bank, a gym, and an ecommerce site.
4. The agent builds a plan, identifies any fees or required evidence, and asks the user to approve the changes.
5. The agent carries out supported actions or opens a guided handoff for steps requiring the user to sign in or complete MFA.
6. The user sees per-destination status and receives a completion summary with confirmations or next actions.

## Functional requirements

### Request intake

- Capture old and new addresses using structured address fields.
- Validate address completeness before submission.
- Let the user set an effective date where a destination supports it.
- Let the user select, add, remove, or skip destinations before execution.

### Planning and consent

- Show the intended action for every destination before execution.
- Disclose expected fees, such as USPS address-change verification fees, before approval.
- Require explicit approval before submitting any change.
- Preserve the user’s chosen destination list and consent record.

### Execution and handoffs

- Run each destination as an independently tracked task.
- Use approved integrations or browser-guided flows; never attempt to defeat security controls.
- Pause with a clear action request when a user must authenticate, complete MFA, solve a CAPTCHA, review a policy, or make a choice.
- Allow a user to retry a failed destination without repeating already completed ones.

### Status and results

- Display a status per destination: not started, in progress, awaiting user, completed, failed, or skipped.
- Record timestamps, confirmation identifiers where available, and error details that are safe to show.
- Provide a final summary with completed work and outstanding actions.

## Trust, privacy, and safety requirements

- Minimize collection and retain only information needed for the requested task.
- Encrypt sensitive user data in transit and at rest.
- Do not persist passwords, MFA codes, or security answers.
- Obtain just-in-time confirmation before consequential external changes.
- Maintain an audit log of approvals, actions attempted, outcomes, and user handoffs.
- Make it easy for a user to cancel unfinished work and delete retained task data.

## Success metrics

- Percentage of started address-change workflows that reach a final state.
- Percentage of selected destinations completed without the user repeating address entry.
- Median time from request creation to final outcome.
- Number of user handoffs per successfully completed destination.
- User-reported confidence that all selected accounts were updated.

## Open questions

- Which bank, gym, and ecommerce providers should be supported in the first pilot?
- Which actions can be performed through official APIs, and which need guided browser handoffs?
- How should the product handle USPS identity verification and fees?
- What level of evidence is required before marking a destination complete?
- Should the first release execute changes, guide users through them, or support both modes?
- Which later workflows best reuse this orchestration pattern: subscription cancellation, utility move-out, insurance updates, or recurring-billing changes?

## Next iteration

Define the first supported providers, map each provider’s permitted flow, and turn the address-change journey into detailed acceptance criteria and UI states.