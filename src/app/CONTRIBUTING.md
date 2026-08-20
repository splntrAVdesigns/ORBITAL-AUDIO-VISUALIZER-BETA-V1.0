# 🤝 CONTRIBUTING TO ORBITAL

Thank you for your interest in contributing to ORBITAL Audio-Reactive Visualizer Engine! This document provides guidelines and instructions for contributing.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How Can I Contribute?](#how-can-i-contribute)
3. [Development Setup](#development-setup)
4. [Coding Guidelines](#coding-guidelines)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Reporting Bugs](#reporting-bugs)
8. [Suggesting Features](#suggesting-features)
9. [Community](#community)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive experience for everyone, regardless of:
- Age, body size, disability, ethnicity, gender identity
- Experience level, nationality, personal appearance
- Race, religion, sexual orientation

### Expected Behavior

- ✅ Be respectful and constructive
- ✅ Welcome newcomers and help them learn
- ✅ Focus on what's best for the community
- ✅ Show empathy towards others

### Unacceptable Behavior

- ❌ Harassment, trolling, or insulting comments
- ❌ Personal or political attacks
- ❌ Publishing others' private information
- ❌ Any conduct inappropriate in a professional setting

---

## How Can I Contribute?

### 🐛 Reporting Bugs

Found a bug? Help us fix it!

1. **Check if it's already reported:** [Search existing issues](https://github.com/yourusername/orbital-visualizer/issues)
2. **Create a new issue** if it doesn't exist
3. **Use the bug report template**
4. **Include:**
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots/videos if applicable
   - Browser version, OS, device
   - Console errors (F12 → Console tab)

**Example Bug Report:**

```markdown
**Bug:** Recording fails to start at 4K resolution

**Steps to Reproduce:**
1. Set resolution to 4K in the Recording section
2. Press R to start recording
3. No recording indicator appears

**Expected:** Recording should start and show a duration counter
**Actual:** Nothing happens, no error in console

**Environment:**
- Browser: Chrome 120.0.6099.109
- OS: Windows 11
- Device: Desktop

**Console Errors:**
TypeError: Cannot read property 'freqData' of null
  at App.tsx:150
```

---

### 💡 Suggesting Features

Have an idea? We'd love to hear it!

1. **Check existing suggestions:** [Feature requests](https://github.com/yourusername/orbital-visualizer/labels/enhancement)
2. **Create a new issue** with `enhancement` label
3. **Describe:**
   - Problem you're trying to solve
   - Proposed solution
   - Alternative solutions considered
   - Use cases and benefits
   - Mockups/examples if applicable

**Example Feature Request:**

```markdown
**Feature:** Custom color palette editor

**Problem:** Users can't create their own color schemes without editing code

**Proposed Solution:**
Add a color palette editor UI with:
- Gradient picker
- Multiple color stops
- Preview in real-time
- Save/export custom palettes

**Benefits:**
- Empowers creative control
- No coding required
- Sharable custom palettes
```

---

### 🎨 Creating Presets

Share your amazing visualizations!

1. **Create your preset** in the app
2. **Export to JSON** (click "EXPORT" button)
3. **Submit via Pull Request:**
   - Add to `/data/presets.ts`
   - Follow naming convention: `"Your Preset Name"`
   - Include description and color palette info
   - Test that it loads correctly

**Preset Guidelines:**
- ✅ Visually distinct from existing presets
- ✅ Good performance (60 FPS on mid-range hardware)
- ✅ Descriptive name
- ✅ Appropriate for public sharing (no offensive content)

---

### 📝 Improving Documentation

Help others learn ORBITAL!

**Documentation needs:**
- Fix typos or unclear explanations
- Add examples or tutorials
- Translate to other languages
- Create video tutorials
- Write blog posts or guides

**How to contribute:**
- Submit PR with documentation changes
- Link to external content (we'll add to README)

---

### 🔧 Code Contributions

Ready to code? Awesome!

**Good first issues:**
- Look for `good first issue` label
- Simple bug fixes
- UI improvements
- Performance optimizations

**Larger features:**
- Discuss in an issue first
- Get feedback before heavy implementation
- Break into smaller PRs when possible

---

## Development Setup

### Prerequisites

- **Node.js 18+** (check: `node --version`)
- **Git** (check: `git --version`)
- **Code editor** (VS Code recommended)

### Setup Steps

```bash
# 1. Fork the repository (click "Fork" on GitHub)

# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/orbital-visualizer.git
cd orbital-visualizer

# 3. Add upstream remote
git remote add upstream https://github.com/original-owner/orbital-visualizer.git

# 4. Install dependencies
npm install

# 5. Start development server
npm run dev

# 6. Open in browser
# Navigate to http://localhost:5173
```

### VS Code Extensions (Recommended)

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking
- **React DevTools** - Component debugging

---

## Coding Guidelines

### TypeScript

- ✅ Use TypeScript for all new code
- ✅ Define interfaces for complex types
- ✅ Avoid `any` type (use `unknown` if needed)
- ✅ Use type inference where clear

```typescript
// ✅ Good
interface AudioParams {
  fftSize: number;
  smoothing: number;
}

function analyzeAudio(params: AudioParams): number[] {
  // ...
}

// ❌ Bad
function analyzeAudio(params: any): any {
  // ...
}
```

### React

- ✅ Use functional components with hooks
- ✅ Extract reusable logic into custom hooks
- ✅ Memoize expensive calculations (`useMemo`, `useCallback`)
- ✅ Clean up effects (return cleanup function)

```typescript
// ✅ Good
useEffect(() => {
  const handleResize = () => { /* ... */ };
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// ❌ Bad - no cleanup
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);
```

### Performance

- ✅ Avoid unnecessary re-renders
- ✅ Use `requestAnimationFrame` for animations
- ✅ Debounce/throttle expensive operations
- ✅ Profile before optimizing (use DevTools)

### Code Style

- ✅ **Indentation:** 2 spaces
- ✅ **Quotes:** Single quotes for strings
- ✅ **Semicolons:** Use them
- ✅ **Line length:** Max 100 characters (flexible)
- ✅ **Comments:** Explain "why", not "what"

```typescript
// ✅ Good comment
// CRITICAL FIX: Prevent double-initialization in React Strict Mode
if (initializingRef.current) return;

// ❌ Bad comment
// Set ref to true
initializingRef.current = true;
```

### Naming Conventions

- **Components:** `PascalCase` (e.g., `RecordingSection.tsx`)
- **Functions:** `camelCase` (e.g., `startRecording()`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_RECORDINGS`)
- **Interfaces:** `PascalCase` (e.g., `AudioParams`)
- **Files:** `camelCase` or `PascalCase` for components

---

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code restructuring (no feature/fix)
- `perf`: Performance improvement
- `test`: Adding/updating tests
- `chore`: Build/tooling changes

### Examples

```bash
feat(recording): add resolution and codec presets to recording panel

- Add resolution presets (720p/1080p/1440p/4K)
- Add codec options (VP9/VP8/H.264) and quality/bitrate presets
- Add keyboard shortcut (R) for start/stop
- Add real-time duration counter

Closes #42
```

```bash
fix(audio): prevent microphone stream memory leak

Stop mic stream on cleanup to prevent browser resource exhaustion.

Fixes #38
```

```bash
docs(readme): update with recording system documentation

- Add recording features section
- Add keyboard shortcuts table
- Update use cases examples
```

### Commit Best Practices

- ✅ One logical change per commit
- ✅ Write clear, descriptive messages
- ✅ Reference issue numbers (`Fixes #123`, `Closes #456`)
- ✅ Keep commits atomic (can be reverted cleanly)

---

## Pull Request Process

### Before Submitting

1. **Update from upstream:**

```bash
git fetch upstream
git merge upstream/main
```

2. **Test thoroughly:**
   - All 4 visualization modes work
   - Recording system works
   - No console errors
   - No performance regressions

3. **Run build:**

```bash
npm run build
```

4. **Lint code:**

```bash
npm run lint (if configured)
```

### Submitting PR

1. **Push to your fork:**

```bash
git push origin your-branch-name
```

2. **Create PR on GitHub**

3. **Fill out PR template:**

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] All modes render correctly
- [ ] No console errors
- [ ] Recording works
- [ ] Performance is good (60 FPS)

## Screenshots
(if applicable)

## Related Issues
Fixes #123
```

4. **Wait for review:**
   - Maintainers will review within 2-7 days
   - Address feedback if requested
   - Be patient and respectful

### After Review

- ✅ Address requested changes
- ✅ Push updates to same branch
- ✅ Comment when ready for re-review
- ❌ Don't force push if possible

---

## Project Structure

Understanding the codebase:

```
src/app/
├── App.tsx                 # Main visualizer engine & render loop
│   ├── Audio setup
│   ├── Canvas rendering
│   ├── Animation loop
│   ├── Recording system
│   └── UI controls
├── components/
│   ├── LandingPage.tsx     # Landing page
│   ├── LoadingPage.tsx     # Loading screen
│   ├── settings/           # Individual settings panel sections
│   └── ui/                 # Reusable UI components
├── engine/                 # WebGL renderers, MIDI, recording
├── data/
│   ├── presets.ts          # 20 preset configurations
│   └── colorPalettes.ts    # 40 color palettes
├── utils/                  # Audio processing, shape generation, helpers
├── config/                 # Macro definitions, default parameters
├── styles/
│   └── globals.css         # Global styles
└── public/                 # Static assets
```

### Key Files to Understand

**For visual features:**
- `App.tsx` - Main render loop and rendering logic
- `data/presets.ts` - Preset structure

**For audio:**
- `App.tsx` - Audio setup and beat detection (search for `AudioContext` and `beatDetect`)
- `utils/audioProcessing.ts` - Beat detection, BPM estimation

**For recording:**
- `App.tsx` - Recording UI wiring
- `engine/RecordingEngine.ts` - The recording implementation itself

*Note: specific line numbers aren't listed here since the codebase has been substantially refactored (see `CHANGELOG.md`) — search by function/feature name instead.*

---

## Testing

### Manual Testing Checklist

Before submitting PR, test:

- [ ] **Modes:** All 4 modes render without errors
- [ ] **Audio:** Mic, file upload, demo tracks work
- [ ] **Recording:** Recording works at each resolution/codec option
- [ ] **Presets:** Load presets without glitches
- [ ] **MIDI:** MIDI device detection (if available)
- [ ] **Images:** Center image upload/delete
- [ ] **Performance:** 60 FPS on mid-range hardware
- [ ] **Browsers:** Chrome, Firefox, Edge
- [ ] **Console:** No errors or warnings

### Automated Tests (Future)

We plan to add:
- Unit tests (Jest + React Testing Library)
- E2E tests (Playwright)
- Performance benchmarks

---

## Release Process

### Version Numbering

**Semantic Versioning:** `MAJOR.MINOR.PATCH`

- **MAJOR:** Breaking changes (e.g., 1.0.0 → 2.0.0)
- **MINOR:** New features (e.g., 1.0.0 → 1.1.0)
- **PATCH:** Bug fixes (e.g., 1.0.0 → 1.0.1)

### Release Checklist (Maintainers)

1. Update `CHANGELOG.md`
2. Update version in `package.json`
3. Create Git tag: `git tag v1.0.1`
4. Push tag: `git push --tags`
5. Create GitHub release with notes
6. Deploy to production (Vercel auto-deploys on tag)

---

## Community

### Get Help

- **GitHub Discussions:** [Ask questions](https://github.com/yourusername/orbital-visualizer/discussions)
- **Issues:** [Report bugs](https://github.com/yourusername/orbital-visualizer/issues)

### Stay Updated

- **Watch repository** for notifications
- **Star repository** to show support
- **Follow maintainers** on GitHub

### Recognition

Contributors are recognized in:
- `Attributions.md` file
- GitHub Contributors page
- Release notes (for significant contributions)

---

## Questions?

- **General:** Open a Discussion
- **Bug/Feature:** Open an Issue
- **Quick question:** Comment on related Issue/PR

---

## Thank You! 🎉

Your contributions make ORBITAL better for everyone. Whether you're fixing a typo, reporting a bug, or adding a major feature, we appreciate your time and effort.

**Happy coding!** 🚀

---

**Last Updated:** 2026-01-22  
**Maintainers:** (Add your name/GitHub handle)  
**License:** MIT