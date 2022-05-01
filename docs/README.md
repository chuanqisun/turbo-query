# Branching

- `release/<major>.<minor>.<patch>`: release branch
  - `CHANGELOG.md` should be cleaned up
- `master` dev branch
  - `CHANGELOG.md` contains roadmap

# Release checklist

- Update Store content
- Update `CHANGELOG.md`
- Upload binary to GitHub release
- Add tag `git tag vX.Y.Z`, then `git push origin vX.Y.Z`
- Clean up release branch afterward
