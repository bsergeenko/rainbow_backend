const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

const usersFile = path.join(__dirname, "data", "users.json");

async function createAdmin() {
  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));

  const adminEmail = "admin@rainbow.design";

  const existingAdmin = users.find(
    (user) => user.email.toLowerCase() === adminEmail.toLowerCase()
  );

  if (existingAdmin) {
    console.log("Admin-Benutzer existiert bereits.");
    return;
  }

  const passwordHash = await bcrypt.hash("Admin123!", 10);

  const adminUser = {
    id: `user-${Date.now()}`,
    firstName: "Admin",
    lastName: "Rainbow",
    email: adminEmail,
    passwordHash,
    role: "main_admin"
  };

  users.push(adminUser);

  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  console.log("Admin-Benutzer wurde erstellt.");
}

createAdmin();