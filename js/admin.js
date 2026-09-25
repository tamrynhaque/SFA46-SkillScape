document.addEventListener("DOMContentLoaded", async () => {
    const heatmapContainer = document.getElementById("heatmap-container");
    const usersContainer = document.getElementById("users-container");

    heatmapContainer.innerHTML = "<p>Loading data...</p>";
    usersContainer.innerHTML = "<p>Loading data...</p>";

    // Fetch all profiles from the users table (app.js uses 'users')
    const { data: profiles } = await supabase.from('users').select('*');
    
    // Fetch all progress with skill details joined
    const { data: allProgress } = await supabase
        .from('user_skills')
        .select(`
            user_id, 
            status,
            skills (name)
        `);

    // Global Heatmap
    const heatmapData = {};
    if (allProgress) {
        allProgress.forEach(p => {
            if (!heatmapData[p.status]) heatmapData[p.status] = 0;
            heatmapData[p.status]++;
        });
    }

    if (Object.keys(heatmapData).length === 0) {
        heatmapContainer.innerHTML = "<p>No progress data available yet.</p>";
    } else {
        let heatmapHTML = `<p><strong>Platform-wide Skill Status Distribution:</strong></p><ul>`;
        for (const [status, count] of Object.entries(heatmapData)) {
            heatmapHTML += `<li>${status}: ${count} skill(s)</li>`;
        }
        heatmapHTML += `</ul>`;
        heatmapContainer.innerHTML = heatmapHTML;
    }

    // User Management
    if (!profiles || profiles.length === 0) {
        usersContainer.innerHTML = "<p>No users registered yet.</p>";
    } else {
        let userHTML = '';
        profiles.forEach(profile => {
            userHTML += `
                <div class="skill-card">
                    <h3>${profile.full_name}</h3>
                    <p><strong>Email:</strong> ${profile.email}</p>
                    <p><strong>Role ID:</strong> ${profile.role_id || "Not selected"}</p>
                    <h4>Current Progress:</h4>
                    <ul>
            `;
            
            const userSkills = allProgress ? allProgress.filter(p => p.user_id === profile.id) : [];
            if (userSkills.length === 0) {
                userHTML += `<li>No progress recorded.</li>`;
            } else {
                userSkills.forEach(us => {
                    const skillName = (us.skills && us.skills.name) ? us.skills.name : "Unknown Skill";
                    userHTML += `<li>${skillName}: <strong>${us.status}</strong></li>`;
                });
            }
            userHTML += `</ul></div>`;
        });
        usersContainer.innerHTML = userHTML;
    }
});
