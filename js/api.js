// "Learning Bridge" - third-party course data.
// Fetches a mocked course API (data/courses.json) standing in for LinkedIn Learning / YouTube / docs.
// Every skill is guaranteed at least one resource: API match -> skill's DB resource_url -> YouTube search.

const CoursesApi = {
    _cache: null,

    async fetchAll() {
        if (this._cache) return this._cache;
        try {
            const response = await fetch("data/courses.json");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            this._cache = json.courses;
        } catch (err) {
            // fetch() is blocked on file:// URLs - serve the folder (e.g. VS Code Live Server) to enable it.
            console.warn("Course API unavailable, using fallback resources:", err.message);
            this._cache = [];
        }
        return this._cache;
    },

    // Courses for a skill: explicit skill_id mapping first, then keyword match on the skill name.
    async forSkill(skill) {
        const courses = await this.fetchAll();
        let matches = courses.filter(c => c.skill_ids.includes(skill.id));
        if (matches.length === 0) {
            const name = skill.name.toLowerCase();
            matches = courses.filter(c => c.keywords.some(k => name.includes(k)));
        }
        if (matches.length === 0) {
            matches = [{
                id: `fallback-${skill.id}`,
                title: `${skill.name} tutorials`,
                provider: "YouTube",
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill.name + " tutorial")}`,
                duration_hours: 3,
                level: skill.level
            }];
            if (skill.resource_url) {
                matches.unshift({ ...matches[0], id: `db-${skill.id}`, title: `${skill.name} resource`, provider: "Suggested", url: skill.resource_url });
            }
        }
        return matches;
    }
};

function courseLink(course) {
    return `<a class="resource-link" href="${escapeHtml(course.url)}" target="_blank" rel="noopener">
        <span class="provider provider-${escapeHtml(course.provider.toLowerCase().replace(/\s+/g, "-"))}">${escapeHtml(course.provider)}</span>
        ${escapeHtml(course.title)} <span class="muted">· ~${course.duration_hours}h</span>
    </a>`;
}
