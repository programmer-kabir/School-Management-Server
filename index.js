const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// Middle ware
app.use(cors());
app.use(express.json());

// Jwt middle ware
const verifyJwt = (req, res, next) =>{
  const authorization = req.headers.authorization
  if(!authorization){
    return res.status(401).send({ error: true, message: "unauthorized token" });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN,(err, decoded) =>{
    if(err){
      return res.status(401).send({ error: true, message: "unauthorized token" });
    }
    req.decoded = decoded
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0i3pjbq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const reviewsCollection = client.db("CourseSelling").collection("reviews");
    const usersCollection = client.db("CourseSelling").collection("users");
    const classCollection = client.db("CourseSelling").collection("class");
    const instructorCollection = client.db("CourseSelling").collection("instructor");
    const bookMarkCollection = client.db("CourseSelling").collection("bookmark");
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
      const id = req.params.id
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
    const verifyAdmin = async (req, res, next) =>{
      const email = req.decoded.email
      const query = {email:email}
      const user = await usersCollection.findOne(query)
      if(user?.role !== 'admin'){
        return res.status(403).send({error:true, message:'forbidden access'})
      }
      next()
    }

    app.get('/users/admin/:email', verifyJwt, async(req, res)=>{
      const email = req. params.email

      if(req.decoded.email !== email){
        res.send({admin:false})
      }
      const query = {email:email}
      const user = await usersCollection.findOne(query)
      const result = {admin:user?.role  === 'admin'}
      res.send(result)
    })

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Instructor
    app.get('/users/instructor/:email', verifyJwt, async(req, res)=>{
      const email = req. params.email

      if(req.decoded.email !== email){
        res.send({instructor:false})
      }
      const query = {email:email}
      const user = await usersCollection.findOne(query)
      const result = {instructor:user?.role  === 'instructor'}
      res.send(result)
    })
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
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
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $unset: {
          role: "", 
      },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Class Section
    app.get("/all-class",async(req, res) =>{
      const result = await classCollection.find().toArray()
      res.send(result)
    } )

    // Instructor Section
    app.get("/instructor",async(req, res) =>{
      const result = await instructorCollection.find().toArray()
      res.send(result)
    } )
    app.get("/instructor/:id",async(req, res) =>{
      const id = req.params.id;
      const objectId = new ObjectId(id);
      const result = await instructorCollection.findOne({ _id: objectId });      
      res.send(result)

    } )

    // BookMark Section
    app.post("/booked", async (req, res) => {
      const body = req.body.saveData;
      console.log(body);
      const id = body.id;
      const filter = { id: id };

      const data = await bookMarkCollection.findOne(filter);
      if (data) {
        return res.send({ message: "Class already exist" });
      } else {
        const result = await bookMarkCollection.insertOne(body);
        res.send(result);
      }  
   
    });

    app.get('/booked', async(req, res) =>{
      const userEmail = req.query.userEmail;
      console.log(userEmail);
      if(!userEmail){
        res.send([])
      }
      const query = { userEmail:userEmail  };
      console.log(query);
      const result = await bookMarkCollection.find(query).toArray();
      res.send(result);
    })

    // Review Section
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "MongoDB connected successfully !!!"
    );
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
