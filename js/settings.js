// Settings: edit display name and role path; reset progress.

document.addEventListener("DOMContentLoaded", async () => {
    const session = requireLogin();
    if (!session) return;

    const form = document.getElementById("settings-form");
    const nameInput = document.getElementById("fullName");
    const roleSelect = document.getElementById("role");
    const notifySelect = document.getElementById("notifications");

    try {
        const [me, roles] = await Promise.all([Store.user(session.id), Store.roles()]);
        roleSelect.innerHTML += roles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
        nameInput.value = me?.full_name || "";
        document.getElementById("email").value = session.email;
        roleSelect.value = me?.role_id ?? "";
    } catch (err) {
        toast("Could not load settings: " + err.message, "error");
    }
    notifySelect.value = LocalCache.read("notifications", "all");

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const fullName = nameInput.value.trim();
        try {
            await Store.updateUser(session.id, { full_name: fullName, role_id: roleSelect.value ? Number(roleSelect.value) : null });
            LocalCache.write("notifications", notifySelect.value);
            localStorage.setItem("userName", fullName);
            toast("Settings saved");
        } catch (err) {
            toast("Could not save settings: " + err.message, "error");
        }
    });

    document.getElementById("reset-btn").addEventListener("click", async () => {
        if (!confirm("Clear ALL of your skill progress and SMART targets?")) return;
        try {
            const r1 = await supabase.from("user_skills").delete().eq("user_id", session.id);
            const r2 = await supabase.from("smart_targets").delete().eq("user_id", session.id);
            if (r1.error || r2.error) throw (r1.error || r2.error);
            LocalCache.write(`progress.${session.id}`, {});
            LocalCache.write(`targets.${session.id}`, []);
            toast("Progress reset");
        } catch (err) {
            toast("Could not reset progress: " + err.message, "error");
        }
    });
});
