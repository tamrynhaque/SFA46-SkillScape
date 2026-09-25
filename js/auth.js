document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    // --- REGISTRATION ---
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("name").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm-password").value;

            if (password !== confirmPassword) {
                alert("Passwords do not match. Please try again.");
                return;
            }

            // 1. Create the user in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { full_name: name }
                }
            });

            if (authError) {
                alert("Registration failed: " + authError.message);
                return;
            }

            // 2. Insert a matching row into the 'users' table
            const userId = authData.user.id;
            const { error: dbError } = await supabase.from('users').insert({
                id: userId,
                email: email,
                role_id: null,
                is_admin: false
            });

            if (dbError) {
                console.error("Could not create user profile:", dbError.message);
            }

            // 3. Save to localStorage and redirect
            localStorage.setItem("userEmail", email);
            localStorage.setItem("userRole", "user");

            alert("Account created successfully! Redirecting to dashboard.");
            window.location.href = "index.html";
        });
    }

    // --- LOGIN ---
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                alert("Invalid email or password. Please try again.");
                return;
            }

            // Check if the user is an admin
            const { data: profile } = await supabase.from('users').select('is_admin').eq('email', email).single();

            localStorage.setItem("userEmail", email);

            if (profile && profile.is_admin) {
                localStorage.setItem("userRole", "admin");
                window.location.href = "admin.html";
            } else {
                localStorage.setItem("userRole", "user");
                window.location.href = "index.html";
            }
        });
    }
});
