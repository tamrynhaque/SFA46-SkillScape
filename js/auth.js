// Login & registration against the Supabase 'users' table.
// NOTE (hackathon prototype): passwords are stored/compared in plain text in the users table.
// For production this should move to Supabase Auth (supabase.auth.signUp / signInWithPassword).

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    // Already signed in? Skip the form.
    const existing = Session.get();
    if (existing && existing.id) {
        window.location.href = existing.isAdmin ? "admin.html" : "index.html";
        return;
    }

    async function findUser(email) {
        const { data, error } = await supabase.from("users")
            .select("id, email, full_name, role_id, is_admin, password")
            .eq("email", email.toLowerCase())
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    // --- LOGIN ---
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;
            const button = loginForm.querySelector("button[type=submit]");
            button.disabled = true;

            try {
                const user = await findUser(email);
                if (!user || user.password !== password) {
                    toast("Invalid email or password. Please try again.", "error");
                    button.disabled = false;
                    return;
                }
                Session.set(user);
                window.location.href = user.is_admin ? "admin.html" : "index.html";
            } catch (err) {
                toast("Login failed: " + err.message, "error");
                button.disabled = false;
            }
        });
    }

    // --- REGISTRATION ---
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("email").value.trim().toLowerCase();
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm-password").value;

            if (password !== confirmPassword) {
                toast("Passwords do not match. Please try again.", "error");
                return;
            }
            if (password.length < 4) {
                toast("Password must be at least 4 characters.", "error");
                return;
            }

            const button = registerForm.querySelector("button[type=submit]");
            button.disabled = true;
            try {
                if (await findUser(email)) {
                    toast("An account with that email already exists - please log in.", "error");
                    button.disabled = false;
                    return;
                }
                const newUser = {
                    id: crypto.randomUUID(),
                    email,
                    full_name: name,
                    password,
                    role_id: null,
                    is_admin: false
                };
                const { error } = await supabase.from("users").insert(newUser);
                if (error) throw error;

                Session.set(newUser);
                window.location.href = "roles.html"; // first step for a new consultant: pick a role
            } catch (err) {
                toast("Registration failed: " + err.message, "error");
                button.disabled = false;
            }
        });
    }
});
