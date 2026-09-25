// Imports
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");

// Data files
const products = require("./data/products.json");
const designs = require("./data/designs.json");
const usersFile = path.join(__dirname, "data", "users.json");
const wishlistsFile = path.join(__dirname, "data", "wishlists.json");
const cartsFile = path.join(__dirname, "data", "carts.json");
const ordersFile = path.join(__dirname, "data", "orders.json");
const contactsFile = path.join(__dirname, "data", "contacts.json");

// App configuration
const app = express();
const PORT = 3000;

const shippingOptions = [
  {
    id: "standard",
    name: "Standardversand",
    price: 4.99
  },
  {
    id: "express",
    name: "Expressversand",
    price: 9.99
  }
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
      ) {
        return callback(null, true);
      }

      callback(new Error("Origin nicht erlaubt."));
    },
    credentials: true
  })
);

app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: "rainbow-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
    secure: false,
    sameSite: "lax"
  }
  })
);

// Finds product images and groups them by color
function getProductImagesByColor(folder, prefix, colors) {
  const fullPath = path.join(__dirname, "public", "assets", folder);

  if (!fs.existsSync(fullPath)) {
    return {};
  }

  const files = fs.readdirSync(fullPath);
  const imagesByColor = {};

  colors.forEach((color) => {
    const matchingFiles = files.filter((file) =>
      file.startsWith(`${prefix}_${color}_`)
    );

    if (matchingFiles.length > 0) {
      imagesByColor[color] = matchingFiles.map(
        (file) => `/assets/${folder}/${file}`
      );
    }
  });

  return imagesByColor;
}

// Returns all colors available for customizable products
function getCustomColors() {
  return [
    ...new Set(
      products
        .filter((product) => product.customizable)
        .flatMap((product) => product.colors)
    )
  ];
}

// Reads all registered users from users.json
function readUsers() {
  return JSON.parse(fs.readFileSync(usersFile, "utf8"));
}

// Saves users back to users.json
function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Reads all wishlists from wishlists.json
function readWishlists() {
  return JSON.parse(fs.readFileSync(wishlistsFile, "utf8"));
}

// Saves all wishlists back to wishlists.json
function writeWishlists(wishlists) {
  fs.writeFileSync(wishlistsFile, JSON.stringify(wishlists, null, 2));
}

// Reads all carts from carts.json
function readCarts() {
  return JSON.parse(fs.readFileSync(cartsFile, "utf8"));
}

// Saves all carts back to carts.json
function writeCarts(carts) {
  fs.writeFileSync(cartsFile, JSON.stringify(carts, null, 2));
}

// Reads all orders from orders.json
function readOrders() {
  return JSON.parse(fs.readFileSync(ordersFile, "utf8"));
}

// Saves all orders back to orders.json
function writeOrders(orders) {
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
}

// Reads all contact messages from contacts.json
function readContacts() {
  return JSON.parse(fs.readFileSync(contactsFile, "utf8"));
}

// Saves all contact messages back to contacts.json
function writeContacts(contacts) {
  fs.writeFileSync(contactsFile, JSON.stringify(contacts, null, 2));
}

// General route
app.get("/", (req, res) => {
  res.send("Rainbow Backend läuft.");
});

// Product API
app.get("/products", (req, res) => {
  const productsWithImages = products.map((product) => {
    return {
      ...product,
      imagesByColor: getProductImagesByColor(
        product.imageFolder,
        product.imagePrefix,
        product.colors
)
    };
  });

  res.json(productsWithImages);
});

app.get("/products/:id", (req, res) => {
  const product = products.find(
    (item) => item.id === req.params.id
  );

  if (!product) {
    return res.status(404).json({
      message: "Produkt nicht gefunden"
    });
  }

  const productWithImages = {
    ...product,
    imagesByColor: getProductImagesByColor(
      product.imageFolder,
      product.imagePrefix,
      product.colors
    )
  };

  res.json(productWithImages);
});

// Returns all colors available for customizable products
app.get("/custom-colors", (req, res) => {
  res.json(getCustomColors());
});

// Design API
app.get("/designs", (req, res) => {
  res.json(designs);
});

// Authentication
// Register a new user
app.post("/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      message: "Alle Pflichtfelder müssen ausgefüllt werden."
    });
  }

  const users = readUsers();

  const existingUser = users.find(
    (user) => user.email.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    return res.status(409).json({
      message: "Diese E-Mail-Adresse ist bereits registriert."
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = {
    id: `user-${Date.now()}`,
    firstName,
    lastName,
    email,
    passwordHash
  };

  users.push(newUser);
  writeUsers(users);

  res.status(201).json({
    id: newUser.id,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    email: newUser.email
  });
});

// Log in and store the user ID in the session
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "E-Mail und Passwort müssen ausgefüllt werden."
    });
  }

  const users = readUsers();

  const user = users.find(
    (item) => item.email.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    return res.status(401).json({
      message: "E-Mail oder Passwort ist falsch."
    });
  }

  const passwordIsCorrect = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordIsCorrect) {
    return res.status(401).json({
      message: "E-Mail oder Passwort ist falsch."
    });
  }

  // Moves the guest cart to the user's cart after login
const guestCartItems = req.session.guestCartItems || [];

if (guestCartItems.length > 0) {
  const carts = readCarts();

  let userCart = carts.find(
    (cart) => cart.userId === user.id
  );

  if (!userCart) {
    userCart = {
      userId: user.id,
      items: []
    };

    carts.push(userCart);
  }

  guestCartItems.forEach((guestItem) => {
    const existingItem = userCart.items.find(
      (item) =>
        item.productId === guestItem.productId &&
        item.color === guestItem.color &&
        item.size === guestItem.size &&
        item.designId === guestItem.designId &&
        item.pocketRequest === guestItem.pocketRequest
    );

    if (existingItem) {
      existingItem.quantity += guestItem.quantity;
    } else {
      userCart.items.push(guestItem);
    }
  });

  writeCarts(carts);
  req.session.guestCartItems = [];
}

  req.session.userId = user.id;
  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email
  });
});

// Return the currently logged-in user
app.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Nicht eingeloggt."
    });
  }

  const users = readUsers();

  const user = users.find(
    (item) => item.id === req.session.userId
  );

  if (!user) {
    return res.status(404).json({
      message: "Benutzer nicht gefunden."
    });
  }

  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email
  });
});

// Destroy the current session
app.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        message: "Logout fehlgeschlagen."
      });
    }

    res.json({
      message: "Erfolgreich ausgeloggt."
    });
  });
});

// Wishlist API
// Returns the wishlist of the currently logged-in user
app.get("/wishlist", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Nicht eingeloggt."
    });
  }

  const wishlists = readWishlists();

  const wishlist = wishlists.find(
    (item) => item.userId === req.session.userId
  );

  if (!wishlist) {
    return res.json([]);
  }

  const wishlistItems = wishlist.items
    .map((wishlistItem) => {
      const product = products.find(
        (product) => product.id === wishlistItem.productId
      );

      if (!product) {
        return null;
      }

      return {
        itemId: wishlistItem.itemId,
        productId: wishlistItem.productId,
        color: wishlistItem.color,
        product: {
          ...product,
          imagesByColor: getProductImagesByColor(
            product.imageFolder,
            product.imagePrefix,
            product.colors
          )
        }
      };
    })
    .filter(Boolean);

  res.json(wishlistItems);
});

// Adds a product and selected color to the wishlist
app.post("/wishlist", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Nicht eingeloggt."
    });
  }

  const { productId, color } = req.body;

  const product = products.find(
    (product) => product.id === productId
  );

  if (!product) {
    return res.status(404).json({
      message: "Produkt nicht gefunden."
    });
  }

  if (!color || !product.colors.includes(color)) {
    return res.status(400).json({
      message: "Ungültige Farbe."
    });
  }

  const wishlists = readWishlists();

  let wishlist = wishlists.find(
    (item) => item.userId === req.session.userId
  );

  if (!wishlist) {
    wishlist = {
      userId: req.session.userId,
      items: []
    };

    wishlists.push(wishlist);
  }

  const alreadyExists = wishlist.items.some(
    (item) =>
      item.productId === productId &&
      item.color === color
  );

  if (!alreadyExists) {
    wishlist.items.push({
      itemId: `wishlist-${Date.now()}`,
      productId,
      color
    });
  }

  writeWishlists(wishlists);

  res.status(201).json({
    message: "Produkt zur Wunschliste hinzugefügt."
  });
});

// Removes a wishlist item
app.delete("/wishlist/:itemId", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Nicht eingeloggt."
    });
  }

  const wishlists = readWishlists();

  const wishlist = wishlists.find(
    (item) => item.userId === req.session.userId
  );

  if (!wishlist) {
    return res.status(404).json({
      message: "Wunschliste nicht gefunden."
    });
  }

  const itemExists = wishlist.items.some(
    (item) => item.itemId === req.params.itemId
  );

  if (!itemExists) {
    return res.status(404).json({
      message: "Wunschlisten-Eintrag nicht gefunden."
    });
  }

  wishlist.items = wishlist.items.filter(
    (item) => item.itemId !== req.params.itemId
  );

  writeWishlists(wishlists);

  res.json({
    message: "Produkt aus Wunschliste entfernt."
  });
});

// Cart API
// Returns the cart of the guest session
app.get("/cart", (req, res) => {
  if (!req.session.userId) {
    if (!req.session.guestCartItems) {
      req.session.guestCartItems = [];
    }

    return res.json(req.session.guestCartItems);
  }

  const carts = readCarts();

  const cart = carts.find(
    (item) => item.userId === req.session.userId
  );

  if (!cart) {
    return res.json([]);
  }

  res.json(cart.items);
});

// Adds a product or configured product to the cart
app.post("/cart", (req, res) => {
  const {
    productId,
    quantity = 1,
    color,
    size,
    designId = null,
    pocketRequest = ""
  } = req.body;

  const product = products.find(
    (item) => item.id === productId
  );

  if (!product) {
    return res.status(404).json({
      message: "Produkt nicht gefunden."
    });
  }

if (!size || !product.sizes.includes(size)) {
  return res.status(400).json({
    message: "Ungültige Größe."
  });
}

const isCustomConfiguration = designId !== null;

if (isCustomConfiguration) {
  if (!product.customizable || !getCustomColors().includes(color)) {
    return res.status(400).json({
      message: "Ungültige Farbe."
    });
  }
} else {
  if (!color || !product.colors.includes(color)) {
    return res.status(400).json({
      message: "Ungültige Farbe."
    });
  }
}
if (designId) {
  let allowedDesigns = [];

  if (product.category === "women" || product.category === "men") {
    allowedDesigns = designs.adult;
  }

  if (product.category === "kids") {
    allowedDesigns = designs.kids;
  }

  if (product.category === "dogs") {
    allowedDesigns = [...designs.adult, ...designs.kids];
  }

  const designExists = allowedDesigns.some(
    (design) => design.id === designId
  );

  if (!designExists) {
    return res.status(400).json({
      message: "Ungültiges Rückenmotiv."
    });
  }
}

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({
      message: "Die Menge muss mindestens 1 sein."
    });
  }

  // Guest cart
  if (!req.session.userId) {
    if (!req.session.guestCartItems) {
      req.session.guestCartItems = [];
    }

    const existingItem = req.session.guestCartItems.find(
      (item) =>
        item.productId === productId &&
        item.color === color &&
        item.size === size &&
        item.designId === designId &&
        item.pocketRequest === pocketRequest
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      return res.json(existingItem);
    }

    const newItem = {
      itemId: `cart-${Date.now()}`,
      productId,
      quantity,
      color,
      size,
      designId,
      pocketRequest
    };

    req.session.guestCartItems.push(newItem);

    return res.status(201).json(newItem);
  }

  // Logged-in user cart
  const carts = readCarts();

  let cart = carts.find(
    (item) => item.userId === req.session.userId
  );

  if (!cart) {
    cart = {
      userId: req.session.userId,
      items: []
    };

    carts.push(cart);
  }

  const existingItem = cart.items.find(
    (item) =>
      item.productId === productId &&
      item.color === color &&
      item.size === size &&
      item.designId === designId &&
      item.pocketRequest === pocketRequest
  );

  if (existingItem) {
    existingItem.quantity += quantity;
    writeCarts(carts);

    return res.json(existingItem);
  }

  const newItem = {
    itemId: `cart-${Date.now()}`,
    productId,
    quantity,
    color,
    size,
    designId,
    pocketRequest
  };

  cart.items.push(newItem);
  writeCarts(carts);

  res.status(201).json(newItem);
});

// Updates the quantity of a cart item
app.put("/cart/:itemId", (req, res) => {
  const { quantity } = req.body;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({
      message: "Die Menge muss mindestens 1 sein."
    });
  }

  if (!req.session.userId) {
    const cartItem = (req.session.guestCartItems || []).find(
      (item) => item.itemId === req.params.itemId
    );

    if (!cartItem) {
      return res.status(404).json({
        message: "Warenkorb-Eintrag nicht gefunden."
      });
    }

    cartItem.quantity = quantity;
    return res.json(cartItem);
  }

  const carts = readCarts();

  const cart = carts.find(
    (item) => item.userId === req.session.userId
  );

  if (!cart) {
    return res.status(404).json({
      message: "Warenkorb nicht gefunden."
    });
  }

  const cartItem = cart.items.find(
    (item) => item.itemId === req.params.itemId
  );

  if (!cartItem) {
    return res.status(404).json({
      message: "Warenkorb-Eintrag nicht gefunden."
    });
  }

  cartItem.quantity = quantity;
  writeCarts(carts);

  res.json(cartItem);
});

// Removes an item from the cart
app.delete("/cart/:itemId", (req, res) => {
  if (!req.session.userId) {
    const guestCartItems = req.session.guestCartItems || [];

    const itemExists = guestCartItems.some(
      (item) => item.itemId === req.params.itemId
    );

    if (!itemExists) {
      return res.status(404).json({
        message: "Warenkorb-Eintrag nicht gefunden."
      });
    }

    req.session.guestCartItems = guestCartItems.filter(
      (item) => item.itemId !== req.params.itemId
    );

    return res.json({
      message: "Produkt aus dem Warenkorb entfernt."
    });
  }

  const carts = readCarts();

  const cart = carts.find(
    (item) => item.userId === req.session.userId
  );

  if (!cart) {
    return res.status(404).json({
      message: "Warenkorb nicht gefunden."
    });
  }

  const itemExists = cart.items.some(
    (item) => item.itemId === req.params.itemId
  );

  if (!itemExists) {
    return res.status(404).json({
      message: "Warenkorb-Eintrag nicht gefunden."
    });
  }

  cart.items = cart.items.filter(
    (item) => item.itemId !== req.params.itemId
  );

  writeCarts(carts);

  res.json({
    message: "Produkt aus dem Warenkorb entfernt."
  });
});

// Orders API
// Creates a new order
// Returns available shipping options
app.get("/shipping-options", (req, res) => {
  res.json(shippingOptions);
});

app.post("/orders", (req, res) => {
  const {
    customer,
    shippingMethod,
    paymentMethod,
    items
  } = req.body;

  if (
    !customer ||
    !customer.firstName ||
    !customer.lastName ||
    !customer.email ||
    !customer.street ||
    !customer.postalCode ||
    !customer.city ||
    !customer.country
  ) {
    return res.status(400).json({
      message: "Kundendaten ist unvollständig."
    });
  }

  if (!shippingMethod) {
    return res.status(400).json({
      message: "Versandart muss ausgewählt werden."
    });
  }

  if (paymentMethod !== "card") {
    return res.status(400).json({
      message: "Ungültige Zahlungsmethode."
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "Die Bestellung enthält keine Produkte."
    });
  }

  let subtotal = 0;

const calculatedItems = [];

for (const item of items) {
  const product = products.find(
    (product) => product.id === item.productId
  );

  if (!product) {
    return res.status(404).json({
      message: `Produkt ${item.productId} wurde nicht gefunden.`
    });
  }

  if (!item.size || !product.sizes.includes(item.size)) {
    return res.status(400).json({
      message: "Ungültige Größe."
    });
  }

  const isCustomConfiguration = item.designId != null;

  if (isCustomConfiguration) {
    if (
      !product.customizable ||
      !getCustomColors().includes(item.color)
    ) {
      return res.status(400).json({
        message: "Ungültige Farbe."
      });
    }
  } else {
    if (!item.color || !product.colors.includes(item.color)) {
      return res.status(400).json({
        message: "Ungültige Farbe."
      });
    }
  }

  if (item.designId) {
    let allowedDesigns = [];

    if (product.category === "women" || product.category === "men") {
      allowedDesigns = designs.adult;
    }

    if (product.category === "kids") {
      allowedDesigns = designs.kids;
    }

    if (product.category === "dogs") {
      allowedDesigns = [...designs.adult, ...designs.kids];
    }

    const designExists = allowedDesigns.some(
      (design) => design.id === item.designId
    );

    if (!designExists) {
      return res.status(400).json({
        message: "Ungültiges Rückenmotiv."
      });
    }
  }

  let unitPrice;

  if (product.pricesBySize) {
    unitPrice = product.pricesBySize[item.size];

    if (unitPrice === undefined) {
      return res.status(400).json({
        message: `Für die gewählte Größe von ${product.name} wurde kein Preis gefunden.`
      });
    }
  } else {
    unitPrice = product.price;
  }

  const quantity = item.quantity || 1;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({
      message: "Die Produktmenge muss mindestens 1 sein."
    });
  }

  const itemTotal = unitPrice * quantity;
  subtotal += itemTotal;

  calculatedItems.push({
    ...item,
    unitPrice,
    itemTotal
  });
}

const selectedShipping = shippingOptions.find(
  (option) => option.id === shippingMethod
);

if (!selectedShipping) {
  return res.status(400).json({
    message: "Ungültige Versandart."
  });
}

const shippingCost = selectedShipping.price;

  const total = Number((subtotal + shippingCost).toFixed(2));

  const orders = readOrders();

  const newOrder = {
    id: `order-${Date.now()}`,
    userId: req.session.userId || null,
    customer,
    shippingMethod,
    shippingCost,
    paymentMethod,
    items: calculatedItems,
    subtotal,
    total,
    createdAt: new Date().toISOString()
  };

  orders.push(newOrder);
  writeOrders(orders);

  // Clears the cart after a successful order
  if (req.session.userId) {
    const carts = readCarts();

    const userCart = carts.find(
      (cart) => cart.userId === req.session.userId
    );

    if (userCart) {
      userCart.items = [];
      writeCarts(carts);
    }
  } else {
    req.session.guestCartItems = [];
  }

  res.status(201).json(newOrder);
});

// Returns all orders of the currently logged-in user
app.get("/orders", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Nicht eingeloggt."
    });
  }

  const orders = readOrders();

  const userOrders = orders.filter(
    (order) => order.userId === req.session.userId
  );

  res.json(userOrders);
});

// Contact API
// Saves a new contact message
app.post("/contact", (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      message: "Alle Pflichtfelder müssen ausgefüllt werden."
    });
  }

  const contacts = readContacts();

  const newContact = {
    id: `contact-${Date.now()}`,
    name,
    email,
    subject,
    message,
    createdAt: new Date().toISOString()
  };

  contacts.push(newContact);
  writeContacts(contacts);

  res.status(201).json({
    message: "Nachricht wurde erfolgreich gesendet."
  });
});


// Start server
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});