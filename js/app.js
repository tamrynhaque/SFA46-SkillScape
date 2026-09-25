// Mock Data for Roles & Skills (Third-Party Data substitute)
const rolesData = {
    "junior_tester": [
        { id: "t1", name: "Manual Testing Basics", level: 1, resource: "https://www.youtube.com/results?search_query=manual+testing+basics" },
        { id: "t2", name: "Bug Tracking (Jira)", level: 2, resource: "https://www.linkedin.com/learning/topics/jira" },
        { id: "t3", name: "Intro to Automation", level: 3, resource: "https://www.selenium.dev/documentation/" }
    ],
    "java_dev": [
        { id: "j1", name: "Java Fundamentals", level: 1, resource: "https://docs.oracle.com/javase/tutorial/" },
        { id: "j2", name: "Spring Boot Basics", level: 2, resource: "https://spring.io/guides" },
        { id: "j3", name: "Microservices", level: 3, resource: "https://www.linkedin.com/learning/topics/microservices" }
    ]
};

document.addEventListener("DOMContentLoaded", () => {
    const roleSelect = document.getElementById("role-select");
    const skillsSection = document.getElementById("skills-matrix");
    const skillsContainer = document.getElementById("skills-container");
    const targetsSection = document.getElementById("smart-targets");
    const targetsContainer = document.getElementById("targets-container");

    // Load saved role from LocalStorage for persistence
    const savedRole = localStorage.getItem("selectedRole");
    if (savedRole) {
        roleSelect.value = savedRole;
        loadSkills(savedRole);
    }

    roleSelect.addEventListener("change", (e) => {
        const role = e.target.value;
        if (role) {
            localStorage.setItem("selectedRole", role);
            loadSkills(role);
        } else {
            skillsSection.style.display = "none";
            targetsSection.style.display = "none";
            localStorage.removeItem("selectedRole");
        }
    });

    function loadSkills(role) {
        skillsSection.style.display = "block";
        targetsSection.style.display = "block";
        skillsContainer.innerHTML = "";
        targetsContainer.innerHTML = "";

        const skills = rolesData[role];
        let savedProgress = JSON.parse(localStorage.getItem("userProgress")) || {};

        let allComplete = true;

        skills.forEach(skill => {
            const skillDiv = document.createElement("div");
            skillDiv.className = "skill-card";
            
            const currentStatus = savedProgress[skill.id] || "Not Started";
            if (currentStatus !== "Complete") allComplete = false;
            
            skillDiv.innerHTML = `
                <h3>${skill.name} <span class="skill-level">(Level ${skill.level})</span></h3>
                <p>Status: 
                    <select class="status-select" data-id="${skill.id}">
                        <option value="Not Started" ${currentStatus === "Not Started" ? "selected" : ""}>Not Started</option>
                        <option value="In Progress" ${currentStatus === "In Progress" ? "selected" : ""}>In Progress</option>
                        <option value="Complete" ${currentStatus === "Complete" ? "selected" : ""}>Complete</option>
                    </select>
                </p>
                <a href="${skill.resource}" target="_blank" class="resource-link">Learning Resource</a>
            `;
            skillsContainer.appendChild(skillDiv);

            // Generate SMART Target if skill is a "Gap"
            if (currentStatus !== "Complete") {
                const targetDiv = document.createElement("div");
                targetDiv.className = "skill-card";
                targetDiv.innerHTML = `
                    <h4>Target: Improve ${skill.name}</h4>
                    <p><strong>Specific:</strong> Complete the suggested learning resource for ${skill.name}.</p>
                    <p><strong>Measurable:</strong> Summarize 3 key takeaways or build a small proof-of-concept.</p>
                    <p><strong>Achievable:</strong> Block out 2 hours this week to focus on this skill.</p>
                    <p><strong>Relevant:</strong> Essential for closing the gap to reach the next proficiency level.</p>
                    <p><strong>Time-bound:</strong> Complete by the end of next week.</p>
                `;
                targetsContainer.appendChild(targetDiv);
            }
        });

        if (allComplete) {
            targetsContainer.innerHTML = "<p>All skills complete! You have no current skill gaps for this role.</p>";
        }

        // Add event listeners to save progress
        document.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", (e) => {
                const skillId = e.target.getAttribute("data-id");
                const newStatus = e.target.value;
                savedProgress[skillId] = newStatus;
                localStorage.setItem("userProgress", JSON.stringify(savedProgress));
                // Reload to update targets dynamically
                loadSkills(roleSelect.value);
            });
        });
    }
});
