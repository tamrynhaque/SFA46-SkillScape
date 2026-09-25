document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    // Helper to generate UUIDs
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // --- REGISTRATION ---
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("name") ? document.getElementById("name").value : "";
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm-password").value;

            if (password !== confirmPassword) {
                alert("Passwords do not match. Please try again.");
                return;
            }

            const userId = generateUUID();

            // Insert into the 'users' table directly
            const { error: dbError } = await supabase.from('users').insert({
                id: userId,
                username: username,
                password: password,
                full_name: name,
                role_id: null,
                is_admin: false,
                email: username + "@mock.com" // fallback in case the DB still requires an email column
            });

            if (dbError) {
                alert("Could not create user profile: " + dbError.message);
                return;
            }

            // --- RANDOM SKILLS ASSIGNMENT ---
            try {
                const { data: roles } = await supabase.from('roles').select('id');
                if (roles && roles.length > 0) {
                    const randomRole = roles[Math.floor(Math.random() * roles.length)];
                    await supabase.from('users').update({ role_id: randomRole.id }).eq('id', userId);
                    
                    const { data: roleSkills } = await supabase.from('role_skills').select('skill_id').eq('role_id', randomRole.id);
                    if (roleSkills && roleSkills.length > 0) {
                        const statuses = ["Not Started", "In Progress", "Complete"];
                        const userSkillsToInsert = roleSkills.map(rs => ({
                            user_id: userId,
                            skill_id: rs.skill_id,
                            status: statuses[Math.floor(Math.random() * statuses.length)]
                        }));
                        await supabase.from('user_skills').insert(userSkillsToInsert);
                    }
                }
            } catch (err) {
                console.error("Error randomly assigning skills:", err);
            }
            // --------------------------------

            // Save to localStorage and redirect
            localStorage.setItem("username", username);
            if (name) localStorage.setItem("userName", name);
            localStorage.setItem("userRole", "user");

            alert("Account created successfully! Redirecting to dashboard.");
            window.location.href = "index.html";
        });
    }

    // --- LOGIN ---
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;

            // Query database directly checking username and password
            const { data: profile, error } = await supabase.from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (error || !profile) {
                alert("Invalid username or password. Please try again.");
                return;
            }

            localStorage.setItem("username", username);
            if (profile.full_name) {
                localStorage.setItem("userName", profile.full_name);
            }

            if (profile.is_admin) {
                localStorage.setItem("userRole", "admin");
                window.location.href = "admin.html";
            } else {
                localStorage.setItem("userRole", "user");
                window.location.href = "index.html";
            }
        });
    }
});
