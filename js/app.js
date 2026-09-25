document.addEventListener("DOMContentLoaded", async () => {
    const roleSelect = document.getElementById("role-select");
    const skillsSection = document.getElementById("skills-matrix");
    const skillsContainer = document.getElementById("skills-container");
    const targetsSection = document.getElementById("smart-targets");
    const targetsContainer = document.getElementById("targets-container");

    const username = localStorage.getItem("username");
    if (!username) {
        window.location.href = "login.html";
        return;
    }

    // Update the dashboard header
    const emailDisplay = document.getElementById("user-display-email");
    const nameDisplay = document.getElementById("user-display-name");
    if (emailDisplay) emailDisplay.textContent = username;

    // Helper to generate UUIDs
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Fetch roles for dropdown from Supabase
    const { data: roles } = await supabase.from('roles').select('*');
    if (roles) {
        roleSelect.innerHTML = '<option value="">-- Choose a Role --</option>';
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.name;
            roleSelect.appendChild(option);
        });
    }

    // Check if user already has a record in the 'users' table
    let { data: profile } = await supabase.from('users').select('*').eq('username', username).single();
    
    if (profile) {
        if (nameDisplay) nameDisplay.textContent = profile.full_name || profile.username;
        
        if (profile.role_id) {
            roleSelect.value = profile.role_id;
            loadSkills(profile);
        }
    } else {
        const userName = localStorage.getItem("userName");
        if (nameDisplay) nameDisplay.textContent = userName || "New User";
        // Create the user in the database since they don't exist yet
        const newUser = {
            id: generateUUID(),
            username: username,
            full_name: userName || null,
            role_id: null,
            is_admin: false,
            email: username + "@mock.com"
        };
        const { data: insertedUser } = await supabase.from('users').insert(newUser).select().single();
        if (insertedUser) {
            profile = insertedUser;
        } else {
            profile = newUser; // Fallback

        }
    }

    roleSelect.addEventListener("change", async (e) => {
        const roleId = e.target.value;
        if (roleId && profile) {
            // Update profile with new role
            await supabase.from('users').update({ role_id: roleId }).eq('id', profile.id);
            profile.role_id = roleId;
            loadSkills(profile);
        } else {
            skillsSection.style.display = "none";
            targetsSection.style.display = "none";
        }
    });

    async function loadSkills(currentProfile) {
        skillsSection.style.display = "block";
        targetsSection.style.display = "block";
        skillsContainer.innerHTML = "<p>Loading skills...</p>";
        targetsContainer.innerHTML = "";

        // Fetch skills via the 'role_skills' join table
        const { data: roleSkills } = await supabase
            .from('role_skills')
            .select('skill_id, skills(id, name, level, resource_url)')
            .eq('role_id', currentProfile.role_id);
            
        const skills = roleSkills ? roleSkills.map(rs => rs.skills) : [];
        
        // Fetch user progress from 'user_skills'
        const { data: progressData } = await supabase.from('user_skills').select('*').eq('user_id', currentProfile.id);
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
                    <h3>${skill.name} <span class="skill-level">(Level ${skill.level})</span></h3>
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
        } else {
            skillsContainer.innerHTML = "<p>No skills found for this role in the database.</p>";
        }

        // Add event listeners to save progress to DB
        document.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", async (e) => {
                const skillId = e.target.getAttribute("data-id");
                const newStatus = e.target.value;
                
                // Upsert progress in user_skills
                await supabase.from('user_skills').upsert({
                    user_id: currentProfile.id,
                    skill_id: skillId,
                    status: newStatus
                }, { onConflict: 'user_id, skill_id' });
                
                // Reload to update targets dynamically
                loadSkills(currentProfile);
            });
        });
    }
});
