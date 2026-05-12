# 🚀 E-Commerce Full Stack Project (MERN Stack)

A full-stack e-commerce application built with **React, Node.js, Express, MongoDB, Firebase Authentication, JWT, and Stripe Payment Gateway**. Backend is deployed on **Vercel** and connected with MongoDB Atlas.

---

## 🌐 Live Links

- 🔗 Frontend:https://e-commerce-font.vercel.app/
- 🔗 Backend API:https://e-commerce-backend-nine-xi.vercel.app/ 

---

## ⚙️ Tech Stack

### Backend:
- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT Authentication
- Stripe Payment
- Cookie-parser
- CORS
- dotenv

### Frontend:
- React.js
- Firebase Auth
- Axios
- Tailwind CSS

---

## ✨ Features

- 🔐 User Authentication (JWT + Firebase)
- 👤 Role-based access (Admin/User)
- 🛍️ Product CRUD system
- 🛒 Cart & Order management
- 💳 Stripe payment integration
- 🍪 Secure HTTP-only cookies
- 🔒 Protected routes
- 🌍 Fully REST API backend
- ☁️ Deployed on Vercel

---

## 📁 Backend Structure

```text
server/
│── index.js
│── app.js
│
├── config/
│   └── db.js
│
├── models/
│   ├── user.model.js
│   ├── product.model.js
│   └── order.model.js
│
├── routes/
│   ├── auth.routes.js
│   ├── product.routes.js
│   ├── order.routes.js
│   └── payment.routes.js
│
├── middleware/
│   ├── verifyToken.js
│   └── verifyAdmin.js
│
└── utils/
