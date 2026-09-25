document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    // Hardcoded mock accounts for frontend testing
    const MOCK_ACCOUNTS = {
        "consultant@ten10.com": { 
            password: "password123", 
            role: "user", 
            redirect: "index.html" 
        },
        "admin@ten10.com": { 
            password: "admin123", 
            role: "admin", 
            redirect: "admin.html" 
        }
    };

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            
            const account = MOCK_ACCOUNTS[email];

            if (account && account.password === password) {
                // Mock a successful login
                localStorage.setItem("userEmail", email);
                localStorage.setItem("userRole", account.role);
                
                // Redirect based on their role
                window.location.href = account.redirect;
            } else {
                // Check if user exists in the Supabase 'users' table
                const { data: user } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .single();

                if (user) {
                    // Login successful via Database (accepting any password for hackathon)
                    localStorage.setItem("userEmail", email);
                    localStorage.setItem("userRole", user.is_admin ? "admin" : "user");
                    
                    if (user.full_name) localStorage.setItem("userName", user.full_name);
                    
                    window.location.href = user.is_admin ? "admin.html" : "index.html";
                } else {
                    alert("Invalid email. Please register an account first.");
                }
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const name = document.getElementById("name") ? document.getElementById("name").value : "";
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm-password").value;
            
            if (password !== confirmPassword) {
                alert("Passwords do not match. Please try again.");
                return;
            }
            
            // Mock a successful registration
            localStorage.setItem("userEmail", email);
            if (name) localStorage.setItem("userName", name);
            localStorage.setItem("userRole", "user");
            
            alert("Account created successfully! Redirecting to dashboard.");
            window.location.href = "index.html";
        });
    }
});
