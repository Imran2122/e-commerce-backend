require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const { errorMonitor } = require("nodemailer/lib/xoauth2");
// payment
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
// e-commerce-project
//AQgZ3TzxnYB8ml1g

// igxmgokduhpqllyg
const port = process.env.PORT || 9000;
const app = express();
// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const sendEmail = (emailAddress, emailData) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.NODEMAILER_USER,
      pass: process.env.NODEMAILER_PASS,
    },
  });
  // verify email
  transporter.verify((error, success) => {
    if (error) {
      console.log(error);
    } else {
      console.log("transporter is ready to get the email");
    }
  });
  // sent email
  // transporter function soto korar jonno object ta baire createTransport
  const mailBody = {
    from: process.env.NODEMAILER_USER, // sender address
    to: emailAddress, // list of recipients
    subject: emailData?.subject, // subject line

    html: `<p>${emailData?.message}</p>`, // HTML body
  };

  transporter.sendMail(mailBody, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log(info);
      console.log("Email Sent:" + info.response);
    }
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cjsxoye.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("Ecommerce");
const userCollection = db.collection("users");
const productCollection = db.collection("products");
const ordersCollection = db.collection("orders");
async function run() {
  try {
    await client.connect();

    console.log("MongoDB connected");

    // const db = client.db("Ecommerce");
    // const userCollection = db.collection("users");
    // const productCollection = db.collection("products");
    // const ordersCollection = db.collection("orders");

    //verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      // console.log("data from verifyToken middleware--->", req.user);
      const email = req.user?.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      if (!result || result?.role !== "admin")
        return res
          .status(403)
          .send({ message: "forbidden access Admin Can access Only" });

      next();
    };

    // verify seller middleware
    const verifySeller = async (req, res, next) => {
      // console.log('data from verifyToken middleware--->', req.user?.email)
      const email = req.user?.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      if (!result || result?.role !== "seller")
        return res
          .status(403)
          .send({ message: "Forbidden Access! Seller Only Actions!" });

      next();
    };

    // payment
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { quantity, productId } = req.body;
      const product = await productCollection.findOne({
        _id: new ObjectId(productId),
      });
      if (!product) {
        return res.status(400).send({ message: "Product Not Found" });
      }
      const totalPrice = quantity * product.price * 100;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.send({ clientSecret: client_secret });
    });

    // manage user status
    app.patch("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      if (!user || user?.status === "Requested")
        return res.status(400).send("already request Please Wait some times");

      const updateDoc = {
        $set: {
          status: "Requested",
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Generate jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            // maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // role
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send({ role: result?.role });
    });

    app.get("/all-users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      // ne means this without this information
      const query = { email: { $ne: email } };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    //update user role
    app.patch(
      "/user/role/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const { role } = req.body;
        const filter = { email };
        const updateDoc = {
          $set: { role, status: "Verified" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      },
    );

    // save or update user db  (dynamic hole params hisabe asbe)
    app.post("/users/:email", async (req, res) => {
      // sendEmail();
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      // check if the user is exist
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }

      const result = await userCollection.insertOne({
        ...user,
        role: "customer",
        timestamp: Date.now(),
      });
      res.send(result);
    });

    // save product in db
    app.post("/products", verifyToken, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });

    // get all Product
    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    // get Product By ID

    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    // Save order data in db
    app.post("/order", verifyToken, async (req, res) => {
      const orderInfo = req.body;
      console.log(orderInfo);
      const result = await ordersCollection.insertOne(orderInfo);
      // Send Email
      if (result?.insertedId) {
        // To Customer
        sendEmail(orderInfo?.customer?.email, {
          subject: "Order Successful",
          message: `You've placed an order successfully. Transaction Id: ${result?.insertedId}`,
        });

        // To Seller
        sendEmail(orderInfo?.seller, {
          subject: "Hurray!, You have an order to process.",
          message: `Get the plants ready for ${orderInfo?.customer?.name}`,
        });
      }
      res.send(result);
    });

    // manage product quantity
    app.patch("/products/quantity/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { quantityToUpdate, status } = req.body;
      const filter = { _id: new ObjectId(id) };
      let updateDoc = {
        $inc: { quantity: -quantityToUpdate },
      };

      if (status === "increase") {
        updateDoc = {
          $inc: { quantity: quantityToUpdate },
        };
      }

      const result = await productCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // customer order data
    // get all orders for a specific customer

    app.get("/customer-orders/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await ordersCollection
        .aggregate([
          {
            $match: { "customer.email": email }, //Match specific customers data only by email
          },
          {
            $addFields: {
              productId: { $toObjectId: "$productId" },
            },
          },
          {
            $lookup: {
              // go to a different collection and look for data
              from: "products", // collection name
              localField: "productId",
              foreignField: "_id",
              as: "products",
            },
          },
          { $unwind: "$products" }, // unwind lookup result, return without array
          {
            $addFields: {
              // add these fields in order object
              name: "$products.name",
              image: "$products.image",
              category: "$products.category",
            },
          },
          {
            // remove plants object property from order object
            $project: {
              products: 0,
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    // seller order data
    app.get(
      "/seller-orders/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const email = req.params.email;

        const result = await ordersCollection
          .aggregate([
            {
              $match: { seller: email }, //match specific customer data only by mail
            },
            {
              $addFields: {
                productObjectId: { $toObjectId: "$productId" }, //convert product id string to obj
              },
            },
            {
              $lookup: {
                from: "products", //collection name
                localField: "productObjectId", //look up for the data
                foreignField: "_id", //foreign field of the that data
                as: "product", //return data as product array
              },
            },
            { $unwind: "$product" }, //look up the result return data without array
            {
              $addFields: {
                //create order object
                name: "$product.name",
              },
            },
            {
              $project: {
                product: 0, //remove product field of the object
              },
            },
          ])
          .toArray();

        res.send(result);
      },
    );

    // Cancel/delete an order
    app.delete("/order/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const order = await ordersCollection.findOne(query);
      if (order.status === "Delivered")
        return res
          .status(409)
          .send("Cannot cancel once the product is delivered!");
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    // get inventory data for my inventory

    app.get("/products/seller", verifyToken, verifySeller, async (req, res) => {
      const email = req.user.email;
      const result = await productCollection
        .find({ "seller.email": email })
        .toArray();
      res.send(result);
    });

    // delete my inventory Product
    app.delete("/products/:id", verifyToken, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(filter);
      res.send(result);
    });

    // update seller orders Status
    app.patch("/orders/:id", verifyToken, verifySeller, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status },
      };
      const result = await ordersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // admin stat
    app.get("/admin-stat", verifyToken, verifyAdmin, async (req, res) => {
      // get total user total plant
      const totalUser = await userCollection.estimatedDocumentCount();
      const totalProduct = await productCollection.estimatedDocumentCount();
      // const allOrder = await ordersCollection.find().toArray();

      // const totalPrice = await allOrder.reduce(
      //   (sum, order) => sum + order.price,
      //   0
      // );
      const chartData = await ordersCollection
        .aggregate([
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $toDate: "$_id" },
                },
              },

              quantity: {
                $sum: "$quantity",
              },

              price: {
                $sum: "$price",
              },

              order: {
                $sum: 1,
              },
            },
          },

          {
            $project: {
              _id: 0,
              data: "$_id",
              quantity: 1,
              order: 1,
              price: 1,
            },
          },
          {
            $sort: { data: 1 },
          },
        ])
        .toArray();

      const ordersDetails = await ordersCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$price" },
              totalOrder: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
            },
          },
        ])
        .next();

      res.send({
        totalProduct,
        totalUser,
        ...ordersDetails,
        chartData: chartData,
      });
      console.log(chartData);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!",
    // );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Product Server..");
});
app.get("/ping", (req, res) => {
  res.send("pong");
});

// if (process.env.NODE_ENV !== "production") {
//   app.listen(port, () => {
//     console.log(`Product server is running on port ${port}`);
//   });
// }

// ✅ Always export the app for Vercel
module.exports = app;
