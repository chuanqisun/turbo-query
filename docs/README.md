# Branching

- `vnext`: dev branch
  - `CHANGELOG.md` contains roadmap
- `dev/<major>.<minor>.<patch>`: release branch
  - `CHANGELOG.md` contains release note
- `master` current release branch

# Release checklist

- Update Store content
- Update `CHANGELOG.md`
- Upload binary to GitHub release
- Add tag `git tag -l vX.Y.Z`, then `git push origin vX.Y.Z`
- Clean up release branch afterward
