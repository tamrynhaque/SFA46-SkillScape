document.addEventListener("DOMContentLoaded", () => {
    const heatmapContainer = document.getElementById("heatmap-container");
    const usersContainer = document.getElementById("users-container");

    // In a real application, this would fetch from a database (e.g., Supabase/Firebase)
    // For this bare-bones prototype, we read from LocalStorage to simulate the global state
    const savedProgress = JSON.parse(localStorage.getItem("userProgress")) || {};
    const savedRole = localStorage.getItem("selectedRole") || "None selected";

    // Global Heatmap Mock
    const heatmapData = {};
    for (const [skillId, status] of Object.entries(savedProgress)) {
        if (!heatmapData[status]) heatmapData[status] = 0;
        heatmapData[status]++;
    }

    if (Object.keys(savedProgress).length === 0) {
        heatmapContainer.innerHTML = "<p>No data available yet. Consultants need to update their progress.</p>";
    } else {
        let heatmapHTML = `<p><strong>Platform-wide Skill Status Distribution:</strong></p><ul>`;
        for (const [status, count] of Object.entries(heatmapData)) {
            heatmapHTML += `<li>${status}: ${count} skill(s)</li>`;
        }
        heatmapHTML += `</ul><p><em>(In a full build, this would aggregate data from all users in the database)</em></p>`;
        heatmapContainer.innerHTML = heatmapHTML;
    }

    // User Management & Target Review Mock
    let userHTML = `
        <div class="skill-card">
            <h3>Consultant 1 (Local Demo User)</h3>
            <p><strong>Selected Role:</strong> ${savedRole}</p>
            <h4>Current Progress:</h4>
            <ul>
    `;
    
    if (Object.keys(savedProgress).length === 0) {
        userHTML += `<li>No progress recorded.</li>`;
    } else {
        for (const [skillId, status] of Object.entries(savedProgress)) {
            userHTML += `<li>Skill ID ${skillId}: <strong>${status}</strong></li>`;
        }
    }
    
    userHTML += `</ul></div>`;
    usersContainer.innerHTML = userHTML;
});
