document.addEventListener("DOMContentLoaded", async () => {
    const roleSelect = document.getElementById("role-select");
    const skillsSection = document.getElementById("skills-matrix");
    const skillsContainer = document.getElementById("skills-container");
    const targetsSection = document.getElementById("smart-targets");
    const targetsContainer = document.getElementById("targets-container");

    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
        window.location.href = "login.html";
        return;
    }

    // Update the dashboard header with the current email
    const emailDisplay = document.getElementById("user-display-email");
    const nameDisplay = document.getElementById("user-display-name");
    if (emailDisplay) emailDisplay.textContent = userEmail;

    // Fetch roles for dropdown from Supabase
    const { data: roles } = await supabase.from('roles').select('*');
    if (roles) {
        roleSelect.innerHTML = '<option value="">-- Choose a Role --</option>';
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.role_name;
            roleSelect.appendChild(option);
        });
    }

    // Check if user already has a role saved in profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', userEmail).single();
    if (profile) {
        if (nameDisplay && profile.full_name) {
            nameDisplay.textContent = profile.full_name;
        } else if (nameDisplay) {
            nameDisplay.textContent = "Consultant";
        }
        
        if (profile.role_id) {
            roleSelect.value = profile.role_id;
            loadSkills(profile.role_id);
        }
    } else if (nameDisplay) {
        nameDisplay.textContent = "New User";
    }

    roleSelect.addEventListener("change", async (e) => {
        const roleId = e.target.value;
        if (roleId) {
            // Update profile with new role
            await supabase.from('profiles').update({ role_id: roleId }).eq('email', userEmail);
            loadSkills(roleId);
        } else {
            skillsSection.style.display = "none";
            targetsSection.style.display = "none";
        }
    });

    async function loadSkills(roleId) {
        skillsSection.style.display = "block";
        targetsSection.style.display = "block";
        skillsContainer.innerHTML = "<p>Loading skills...</p>";
        targetsContainer.innerHTML = "";

        // Fetch skills for this role
        const { data: skills } = await supabase.from('skills').select('*').eq('role_id', roleId);
        
        // Fetch user progress
        const { data: progressData } = await supabase.from('user_progress').select('*').eq('user_email', userEmail);
        const savedProgress = {};
        if (progressData) {
            progressData.forEach(p => savedProgress[p.skill_id] = p.status);
        }

        skillsContainer.innerHTML = "";
        let allComplete = true;

        if (skills && skills.length > 0) {
            skills.forEach(skill => {
                const skillDiv = document.createElement("div");
                skillDiv.className = "skill-card";
                
                const currentStatus = savedProgress[skill.id] || "Not Started";
                if (currentStatus !== "Complete") allComplete = false;
                
                skillDiv.innerHTML = `
                    <h3>${skill.skill_name} <span class="skill-level">(Level ${skill.skill_level})</span></h3>
                    <p>Status: 
                        <select class="status-select" data-id="${skill.id}">
                            <option value="Not Started" ${currentStatus === "Not Started" ? "selected" : ""}>Not Started</option>
                            <option value="In Progress" ${currentStatus === "In Progress" ? "selected" : ""}>In Progress</option>
                            <option value="Complete" ${currentStatus === "Complete" ? "selected" : ""}>Complete</option>
                        </select>
                    </p>
                    <a href="${skill.resource_url}" target="_blank" class="resource-link">Learning Resource</a>
                `;
                skillsContainer.appendChild(skillDiv);

                // Generate SMART Target if skill is a "Gap"
                if (currentStatus !== "Complete") {
                    const targetDiv = document.createElement("div");
                    targetDiv.className = "skill-card";
                    targetDiv.innerHTML = `
                        <h4>Target: Improve ${skill.skill_name}</h4>
                        <p><strong>Specific:</strong> Complete the suggested learning resource for ${skill.skill_name}.</p>
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
        } else {
            skillsContainer.innerHTML = "<p>No skills found for this role in the database.</p>";
        }

        // Add event listeners to save progress to DB
        document.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", async (e) => {
                const skillId = e.target.getAttribute("data-id");
                const newStatus = e.target.value;
                
                // Upsert progress
                await supabase.from('user_progress').upsert({
                    user_email: userEmail,
                    skill_id: skillId,
                    status: newStatus
                }, { onConflict: 'user_email, skill_id' });
                
                // Reload to update targets dynamically
                loadSkills(roleSelect.value);
            });
        });
    }
});
