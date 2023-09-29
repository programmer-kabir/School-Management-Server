const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const SSLCommerzPayment = require("sslcommerz-lts");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.SCREAT_KEY);

// Middle ware
app.use(cors());
app.use(express.json());

// Jwt middle ware
const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorized token" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized token" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0i3pjbq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const store_id = process.env.storeId;
const store_passwd = process.env.storePass;
const is_live = false; //true for live, false for sandbox

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const reviewsCollection = client.db("CourseSelling").collection("reviews");
    const usersCollection = client.db("CourseSelling").collection("users");
    const classCollection = client.db("CourseSelling").collection("class");
    const PaymentCollection = client.db("CourseSelling").collection("payments");
    const instructorCollection = client
      .db("CourseSelling")
      .collection("instructor");
    const bookedCollection = client.db("CourseSelling").collection("bookmark");
    // Jwt Token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // User
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.put("/users/:id", async (req, res) => {
      // console.log(id);
      const id = req.params.id;
      // const user = req.body;
      // console.log(user);
      // const filter = { _id: new ObjectId(id) }
      // const updatedDoc ={

      // }
      // const result = await usersCollection.updateOne(filter, user)
      // console.log(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Make Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    app.get("/users/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Instructor
    app.get("/users/instructor/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // User

    app.patch("/users/user/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $unset: {
          role: "",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Class Section
    app.get("/all-class", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // Instructor Section
    app.get("/instructor", async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });
    app.get("/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const objectId = new ObjectId(id);
      const result = await instructorCollection.findOne({ _id: objectId });
      res.send(result);
    });

    // BookMark Section
    app.post("/booked", async (req, res) => {
      const body = req.body.saveData;
      // console.log(body);
      const id = body.id;
      const filter = { id: id };

      const data = await bookedCollection.findOne(filter);
      if (data) {
        return res.send({ message: "Class already exist" });
      } else {
        const result = await bookedCollection.insertOne(body);
        res.send(result);
      }
    });

    app.get("/booked", async (req, res) => {
      const userEmail = req.query.userEmail;
      // console.log(userEmail);
      if (!userEmail) {
        res.send([]);
      }
      const query = { userEmail: userEmail };
      // console.log(query);
      const result = await bookedCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/booked/:id", async (req, res) => {
      const id = req.params.id;
      const userEmail = req.query.userEmail;

      const query = {
        id: new ObjectId(id),
        userEmail: userEmail,
      };

      // console.log("Attempting to delete with query:", query);

      const result = await bookedCollection.deleteOne(query);
      res.send(result);
    });

    // Review Section
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    // Payment

    app.post("/create-payment-intent", verifyJwt, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      console.log(price, amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    
    app.post("/payments", async (req, res) => {
      try {
          const payment = req.body;
          console.log("Payment object:", payment);
  
          const insertResult = await PaymentCollection.insertOne(payment);
          console.log("Insert Result:", insertResult);
  
          // Attempting to delete from bookedCollection
          const bookedIdToDelete = payment.bookedId?._id;
          console.log("Attempting to delete bookedId:", bookedIdToDelete);
  
          const deleteResult = await bookedCollection.deleteOne({
              _id: new ObjectId(bookedIdToDelete)
          });
          console.log("Delete Result:", deleteResult);
  
          res.send({ insertResult, deleteResult });
  
      } catch (error) {
          console.error("Error occurred:", error);
          res.status(500).send({ error: "Internal Server Error" });
      }
  });
  

    app.get("/payment", async (req, res) => {
      const email = req.query.email
      console.log(email);
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await PaymentCollection.find(query).toArray();
      res.send(result);
    });


    // const tran_id = new ObjectId().toString();
    // app.post("/order", async (req, res) => {
    //   const classes = req.body;
    //   const id = req.body.classId;
    //   const classData = await classCollection.findOne({
    //     _id: new ObjectId(id),
    //   });

    //   const data = {
    //     total_amount: 100,
    //     currency: classes?.currency,
    //     trans_id: tran_id, // use unique tran_id for each api call
    //     success_url: `http://localhost:5000/payment/success/${tran_id}`,
    //     fail_url: "http://localhost:3030/fail",
    //     cancel_url: "http://localhost:3030/cancel",
    //     ipn_url: "http://localhost:3030/ipn",
    //     shipping_method: "Courier",
    //     product_name: "Computer.",
    //     product_category: "Electronic",
    //     product_profile: "general",
    //     cus_name: classes?.name,
    //     cus_email: classes?.email,
    //     cus_division: classes?.division,
    //     cus_district: classes?.district,
    //     cus_upZila: classes?.upZila,
    //     cus_postcode: classes?.postCode,
    //     cus_country: "Bangladesh",
    //     cus_phone: classes?.number,
    //     cus_fax: "01711111111",
    //     ship_name: "Customer Name",
    //     ship_add1: "Dhaka",
    //     ship_add2: "Dhaka",
    //     ship_city: "Dhaka",
    //     ship_state: "Dhaka",
    //     ship_postcode: 1000,
    //     ship_country: "Bangladesh",
    //   };
    //   console.log(data);

    //   const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    //   sslcz.init(data).then((apiResponse) => {

    //     let GatewayPageURL = apiResponse.GatewayPageURL;
    //     res.send({ url: GatewayPageURL });

    //     const finalOrder = {
    //       classData,
    //       paidStatus: false,
    //       transitionId: tran_id,
    //       email: classes.email,
    //     };
    //     const result =  PaymentCollection.insertOne(finalOrder);
    //     console.log('Redirecting to: ', GatewayPageURL)
    //   });

    //   app.post("/payment/success/:tranId", async (req, res) => {
    //     console.log(req.params.tranId);
    //     const result = await PaymentCollection.updateOne(
    //       { transitionId: req.params.tranId },
    //       {
    //         $set: {
    //           paidStatus: true,
    //         },
    //       }
    //     );
    //     if (result.modifiedCount > 0) {
    //       await classCollection.updateOne(
    //         { _id: new ObjectId(classData._id) },
    //         {
    //           $inc: {
    //             sits: -1,
    //             enrollStudents: +1,
    //           },
    //         }
    //       );

    //       await bookedCollection.deleteOne({
    //         id: classData._id.toString(),
    //         userEmail: classes.email,
    //       });
    //       res.redirect(
    //         'http://localhost:5173/dashboard'
    //       );
    //     }
    //   });
    // });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB connected successfully !!!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Sever is running");
});
app.listen(port);
