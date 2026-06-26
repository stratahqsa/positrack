<!-- Thanks for contributing to Positrack! Fill this in so a maintainer can merge quickly. -->

## What does this PR do?

<!-- One or two sentences. Link any related issue with "Closes #123". -->

## Checklist

- [ ] `python -m pytest tests/ -q` passes locally
- [ ] `bash scripts/check_sync.sh` prints **engine sync OK**
- [ ] If I changed `core/ytcore.py` or `cli/yt.py`, I re-vendored the skill copies (`skill/positrack/scripts/`)
- [ ] If I changed CLI output on purpose, I updated `tests/golden/` and explained why
- [ ] No tokens/secrets committed; write tools still default to `commit=False`
- [ ] Docs updated if behaviour or setup changed

## Notes for the reviewer

<!-- Anything that needs a human eye: trade-offs, follow-ups, screenshots, etc. -->
