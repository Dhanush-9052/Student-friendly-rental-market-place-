// ================= FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { 
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
  increment,        // ADD THIS
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyD6XDya6MjoVPLNSDsEE4JlpLcKAJsFIrw",
  authDomain: "student-rental-hub.firebaseapp.com",
  projectId: "student-rental-hub",
  storageBucket: "student-rental-hub.firebasestorage.app",
  messagingSenderId: "90362972178",
  appId: "1:90362972178:web:2454cdc265537aac4c70cb",
  measurementId: "G-F3TREG4S3K"
};

// ================= INITIALIZE =================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= REGISTER =================
window.register = async function () {

  const email = document.getElementById("newEmail").value;
  const password = document.getElementById("newPass").value;
  const role = localStorage.getItem("role");

  if (!role) {
    alert("Please select role first");
    window.location.href = "index.html";
    return;
  }

  try {

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save user data in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: email,
      role: role,
      name: "",
      phone: "",
      address: "",
      createdAt: serverTimestamp()
    });

    alert("Account created! Please complete your profile.");

    // Redirect to profile page immediately
    window.location.href = "profile.html";

  } catch (error) {
    alert(error.message);
  }
};

// ================= LOGIN =================
window.login = async function () {

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const selectedRole = localStorage.getItem("role");

  if (!selectedRole) {
    alert("Please select role first");
    window.location.href = "index.html";
    return;
  }

  try {

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();

    if (userData.role !== selectedRole) {

      alert("This account is not registered as " + selectedRole);
      await signOut(auth);
      return;
    }

    // Correct role
    if (userData.role === "owner") {
      window.location.href = "owner.html";
    } else {
      window.location.href = "customer.html";
    }

  } catch (error) {
    alert("Invalid email or password");
  }
};

// ================= LOGOUT =================
window.logout = async function () {

  await signOut(auth);

  // Clear stored role
  localStorage.removeItem("role");

  // Redirect to main landing page
  window.location.href = "index.html";
};

// ================= GO TO REGISTER =================
window.goRegister = function () {
  window.location.href = "register.html";
};

// ================= PAGE PROTECTION =================
onAuthStateChanged(auth, async (user) => {

  const currentPage = window.location.pathname;

  // 🔐 Protect pages
  if (!user &&
      !currentPage.includes("login.html") &&
      !currentPage.includes("register.html") &&
      !currentPage.includes("index.html")) {

    window.location.href = "login.html";
    return;
  }

  if (user) {

    loadHeaderName(user);

    // 🔹 CHECK IF PROFILE IS FILLED
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const data = userDoc.data();

    if ((!data.name || !data.phone || !data.address) &&
        !currentPage.includes("profile.html")) {

      window.location.href = "profile.html";
      return;
    }

    // 👤 Profile page
    if (currentPage.includes("profile.html")) {
      loadProfile(user);
    }

    // 🏠 Owner dashboard
    if (currentPage.includes("owner.html")) {

      hideOwnerSections();
      listenOwnerNotifications();

      // Automatically open My Items
      showMyItems();
    }

    if (currentPage.includes("customer.html")) {

      listenCustomerNotifications();

      // ⭐ CHECK LATE RETURNS
      checkLateReturns(user.uid);

      // Automatically show items
      showItemsForRent();
    }
  }

});

// ================= PROFILE LOAD =================

async function loadProfile(user) {

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.data();

  if (!data) return;

  const viewDiv = document.getElementById("viewProfile");
  const editDiv = document.getElementById("editProfile");

  const vname = document.getElementById("vname");
  const vphone = document.getElementById("vphone");
  const vaddress = document.getElementById("vaddress");

  const pname = document.getElementById("pname");
  const pphone = document.getElementById("pphone");
  const paddress = document.getElementById("paddress");

  // Fill edit inputs
  if (pname) pname.value = data.name || "";
  if (pphone) pphone.value = data.phone || "";
  if (paddress) paddress.value = data.address || "";

  // If profile is empty → open EDIT mode
  if (!data.name || !data.phone || !data.address) {

    if (viewDiv) viewDiv.style.display = "none";
    if (editDiv) editDiv.style.display = "block";

  } 
  else {

    // Show view mode normally
    if (viewDiv) viewDiv.style.display = "block";
    if (editDiv) editDiv.style.display = "none";

    if (vname) vname.innerText = data.name;
    if (vphone) vphone.innerText = data.phone;
    if (vaddress) vaddress.innerText = data.address;

  }

}

// ================= EDIT PROFILE =================
window.editMyProfile = function () {
  document.getElementById("viewProfile").style.display = "none";
  document.getElementById("editProfile").style.display = "block";
};

window.cancelEditProfile = function () {

  const view = document.getElementById("profileView");
  const edit = document.getElementById("profileEdit");

  if (view) view.style.display = "block";
  if (edit) edit.style.display = "none";

};


// ================= SAVE PROFILE =================
window.saveEditedProfile = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const name = document.getElementById("pname").value;
  const phone = document.getElementById("pphone").value;
  const address = document.getElementById("paddress").value;

  if (!name || !phone || !address) {
    alert("Please fill all fields");
    return;
  }

  await updateDoc(doc(db, "users", user.uid), {
    name: name,
    phone: phone,
    address: address
  });

  // Get role to redirect to correct dashboard
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const role = userDoc.data().role;

  alert("Profile saved successfully!");

  if (role === "owner") {
    window.location.href = "owner.html";
  } else {
    window.location.href = "customer.html";
  }

};

// ================= OPEN PROFILE =================
window.showProfile = async function () {

  // Hide all owner sections (Owner dashboard)
  hideOwnerSections();

  // Also hide customer items section (Customer dashboard)
  const itemsDiv = document.getElementById("items");
  if (itemsDiv) itemsDiv.innerHTML = "";

  const profileDiv = document.getElementById("profileSection");
  if (!profileDiv) return;

  profileDiv.style.display = "block";

  const user = auth.currentUser;
  if (!user) return;

  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (userDoc.exists()) {

    const data = userDoc.data();

    document.getElementById("profileName").innerText = data.name || "Not set";
    document.getElementById("profilePhone").innerText = data.phone || "Not set";
    document.getElementById("profileAddress").innerText = data.address || "Not set";

    document.getElementById("editName").value = data.name || "";
    document.getElementById("editPhone").value = data.phone || "";
    document.getElementById("editAddress").value = data.address || "";
  }
};


let currentOwnerView = "";
let currentCustomerView = "";

let ownerRenderToken = 0;
let customerRenderToken = 0;

// ================= ADD ITEM =================
window.addItem = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;
  const deposit = document.getElementById("deposit").value;
  const brand = document.getElementById("brand").value;
  const features = document.getElementById("features").value;
  const quantity = document.getElementById("quantity").value;
  const imageFile = document.getElementById("image").files[0];

  if (!name || !price) {
    alert("Please fill required fields");
    return;
  }

  let imageBase64 = "";

  if (imageFile) {
    const reader = new FileReader();
    reader.onload = async function () {

      imageBase64 = reader.result;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const ownerName = userSnap.exists()
        ? userSnap.data().name || user.email
        : user.email;

      await addDoc(collection(db, "items"), {
        ownerId: user.uid,
        ownerName: ownerName,
        name,
        price: Number(price),
        deposit: Number(deposit) || 0,
        brand,
        features,
        quantity: Number(quantity),
        imageBase64,
        createdAt: serverTimestamp()
      });

      alert("Item added successfully!");
      loadOwnerItems();
    };

    reader.readAsDataURL(imageFile);

  } else {

    const profileSnap = await getDoc(doc(db, "users", user.uid));
    const ownerName = profileSnap.exists() ? profileSnap.data().name : "Owner";

    await addDoc(collection(db, "items"), {
      ownerId: user.uid,
      ownerName,   // ✅ ADD THIS
      name,
      price: Number(price),
      deposit: Number(deposit) || 0,
      brand,
      features,
      quantity: Number(quantity),
      imageBase64,
      createdAt: serverTimestamp()
    });

    alert("Item added successfully!");
    loadOwnerItems();
  }
};

// ================= LOAD OWNER ITEMS =================
window.loadOwnerItems = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const container = document.getElementById("myItems");
  if (!container) return;

  container.innerHTML = `
    <h2>Your Items</h2>

    <input 
      type="text"
      id="ownerSearch"
      class="search-bar"
      placeholder="🔍 Search your items..."
      onkeyup="searchOwnerItems()"
      style="
        
        padding:12px;
        margin:20px 0;
        font-size:16px;
        font-weight:bold;
        border-radius:8px;
        border:1px solid #ccc;
        box-sizing:border-box;
      "
    >
    <p>Loading...</p>
  `;

  // 🔹 Get owner's items
  const q = query(
    collection(db, "items"),
    where("ownerId", "==", user.uid)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    container.innerHTML += "<p>No items added yet</p>";
    return;
  }

  // 🔹 Load ALL reviews only once
  const reviewsSnapshot = await getDocs(collection(db, "reviews"));

  const reviewMap = {};

  reviewsSnapshot.forEach(doc => {

    const data = doc.data();

    if (!reviewMap[data.itemId]) {
      reviewMap[data.itemId] = [];
    }

    reviewMap[data.itemId].push(data.rating);

  });

  // Clear loading text
  container.innerHTML = `
    <h2>Your Items</h2>

    <input 
      type="text"
      id="ownerSearch"
      class="search-bar"
      placeholder="🔍 Search your items..."
      onkeyup="searchOwnerItems()"
      style="
        width:100%;
        padding:12px;
        margin:20px 0;
        font-size:16px;
        font-weight:bold;
        border-radius:8px;
        border:1px solid #ccc;
        box-sizing:border-box;
      "
    >
  `;

  // 🔹 Render items
  snapshot.forEach(docSnap => {

    const item = docSnap.data();
    const itemId = docSnap.id;

    const ratings = reviewMap[itemId] || [];

    let avgRating = "No ratings";
    let reviewCount = 0;

    if (ratings.length > 0) {

      const total = ratings.reduce((a, b) => a + b, 0);
      avgRating = (total / ratings.length).toFixed(1);
      reviewCount = ratings.length;

    }

    container.innerHTML += `
      <div class="item-card">

        <div class="item-left">
          <img src="${item.imageBase64}" alt="Item Image">
        </div>

        <div class="item-right">

          <h2>${item.name}</h2>

          <p>Rent: ₹${item.price}</p>
          <p>Deposit: ₹${item.deposit}</p>
          <p>Brand: ${item.brand}</p>
          <p>Features: ${item.features}</p>
          <p>Quantity: ${item.quantity}</p>

          <p>⭐ ${avgRating} (${reviewCount} reviews)</p>

          <button onclick="editItem('${itemId}')">Edit</button>

          <button onclick="removeItem('${itemId}')">
            Remove
          </button>

          <button onclick="viewOwnerItemReviews('${itemId}', '${item.name}')">
            Reviews
          </button>

        </div>

      </div>
    `;

  });

};

window.viewOwnerItemReviews = async function (itemId, itemName) {

  const container = document.getElementById("myItems");
  if (!container) return;

  container.innerHTML = `<h2>Reviews for ${itemName}</h2>`;

  const reviewQuery = query(
    collection(db, "reviews"),
    where("itemId", "==", itemId)
  );

  const reviewSnapshot = await getDocs(reviewQuery);

  if (reviewSnapshot.empty) {
    container.innerHTML += "<p>No reviews yet</p>";
    container.innerHTML += `<br><button onclick="loadOwnerItems()">Back</button>`;
    return;
  }

  let totalRating = 0;
  reviewSnapshot.forEach(doc => {
    totalRating += doc.data().rating;
  });

  const avgRating = (totalRating / reviewSnapshot.size).toFixed(1);

  container.innerHTML += `
    <p>
      <strong>Average Rating:</strong> 
      ${avgRating} ⭐ (${reviewSnapshot.size} reviews)
    </p>
    <br>
  `;

  for (const docSnap of reviewSnapshot.docs) {

  const review = docSnap.data();

  // 🔥 FETCH NAME FROM USERS COLLECTION
  const userSnap = await getDoc(doc(db, "users", review.customerId));

  let customerName = "Unknown User";

  if (userSnap.exists()) {
    const userData = userSnap.data();
    customerName = userData.name || userData.email;
  }

  // 🔥 USE YOUR EXISTING "date" FIELD
  let formattedDate = "";

  if (review.date) {
    formattedDate = review.date.toDate().toLocaleDateString();
  }

  container.innerHTML += `
    <div style="margin-bottom:20px; border-bottom:1px solid #ccc; padding-bottom:10px;">
      <strong>${customerName}</strong><br>
      Rating: ${review.rating}/5<br>
      Comment: ${review.comment}<br>
      Date: ${formattedDate}
    </div>
  `;
}

  container.innerHTML += `
    <button onclick="loadOwnerItems()">Back</button>
  `;
};

// ================= SHOW ITEMS FOR CUSTOMER =================
window.showItemsForRent = async function () {

  document.getElementById("profileSection").style.display = "none";

  const container = document.getElementById("items");
  if (!container) return;

  container.innerHTML = "Loading...";

  // GET ALL ITEMS
  const itemsQuery = query(
    collection(db, "items"),
    orderBy("createdAt", "desc")
  );

  const itemsSnapshot = await getDocs(itemsQuery);

  // GET ALL REVIEWS (only once)
  const reviewsSnapshot = await getDocs(collection(db, "reviews"));

  const reviewMap = {};

  reviewsSnapshot.forEach(doc => {

    const data = doc.data();

    if (!reviewMap[data.itemId]) {
      reviewMap[data.itemId] = [];
    }

    reviewMap[data.itemId].push(data.rating);

  });

  container.innerHTML = `
    <h2 class="items-heading">Available Items</h2>

    <div style="display:flex; gap:15px; margin:20px 0; align-items:center;">

      <input 
        type="text"
        id="customerSearch"
        placeholder="🔍 Search items..."
        onkeyup="searchCustomerItems()"
        style="height:45px;"
      >

      <select id="itemFilter" onchange="filterItems()"
        style="width:180px; height:45px;">
        <option value="">Filter</option>
        <option value="low-high">Price: Low → High</option>
        <option value="high-low">Price: High → Low</option>
        <option value="available">Available First</option>
      </select>

    </div>
  `;

  if (itemsSnapshot.empty) {
    container.innerHTML += "<p>No items available</p>";
    return;
  }

  itemsSnapshot.forEach(docSnap => {

    const item = docSnap.data();
    const itemId = docSnap.id;

    let ratings = reviewMap[itemId] || [];

    let ratingText = "No reviews";

    if (ratings.length > 0) {

      let total = ratings.reduce((a,b)=>a+b,0);
      let avg = (total / ratings.length).toFixed(1);

      ratingText = `${getStars(Math.round(avg))} ${avg} (${ratings.length} reviews)`;

    }

    container.innerHTML += `
      <div class="item-card" data-price="${item.price}" data-qty="${item.quantity}">

        <div class="item-left">
          <img src="${item.imageBase64}" alt="Item Image">
        </div>

        <div class="item-right">

          <h2>${item.name}</h2>

          <p>${ratingText}</p>

          <p>Rent: ₹${item.price}</p>
          <p>Deposit: ₹${item.deposit}</p>
          <p>Owner: ${item.ownerName || "Owner"}</p>
          <p>Available: ${item.quantity} left</p>

          ${
            item.quantity > 0
            ? `<button onclick="rentItem('${itemId}')">Rent</button>`
            : `<button disabled>No Stock</button>`
          }

          <button onclick="viewReviews('${itemId}')">View Reviews</button>

        </div>

      </div>
    `;

  });

};

// ================= TOGGLE ADD FORM =================
window.toggleAddForm = function () {

  const form = document.getElementById("addForm");

  if (!form) return;

  if (form.style.display === "none" || form.style.display === "") {
    form.style.display = "block";
  } else {
    form.style.display = "none";
  }
};

let selectedItemId = null;
let selectedItemData = null;

// ================= OPEN RENT MODAL =================
window.rentItem = async function (itemId) {

  selectedItemId = itemId;

  const docSnap = await getDoc(doc(db, "items", itemId));
  selectedItemData = docSnap.data();

  document.getElementById("rentModal").style.display = "flex";

  setupDateLimits();
};

// ================= CLOSE MODAL =================
window.closeRentModal = function () {
  document.getElementById("rentModal").style.display = "none";
};

// ================= CONFIRM RENT =================
async function confirmRent() {

  const user = auth.currentUser;
  if (!user) return;

  const fromDate = document.getElementById("rentFrom").value;
  const toDate = document.getElementById("rentTo").value;

  if (!fromDate || !toDate) {
    alert("Please select dates");
    return;
  }

  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (to < from) {
    alert("Invalid date selection");
    return;
  }

  const diffTime = to - from;
  const days = (diffTime / (1000 * 60 * 60 * 24)) + 1;

  const totalRent = days * selectedItemData.price;

  const ownerProfileSnap = await getDoc(
    doc(db, "users", selectedItemData.ownerId)
  );

  const ownerName = ownerProfileSnap.exists()
    ? ownerProfileSnap.data().name
    : "Owner";

  await addDoc(collection(db, "requests"), {
  itemId: selectedItemId,
  itemName: selectedItemData.name,
  customerId: user.uid,
  ownerId: selectedItemData.ownerId,
  ownerName: ownerName,
  fromDate,
  toDate,
  days,
  totalRent,
  deposit: selectedItemData.deposit || 0,
  status: "pending",
  createdAt: serverTimestamp(),

  customerNotified: true,   // ⭐ ADD THIS LINE

  penaltyApplied: false,
  penaltyAmount: 0,
  returnedAt: null
});

  alert("Rent request sent successfully!");
  closeRentModal();
}

window.confirmRent = confirmRent;

// ================= OWNER NOTIFICATIONS PANEL =================

window.openOwnerNotifications = async function () {

  hideOwnerSections();

  const container = document.getElementById("myItems");
  if (!container) return;

  container.style.display = "block";
  container.innerHTML = "<h2>Notifications</h2><p>Loading...</p>";

  const user = auth.currentUser;
  if (!user) return;

  const reqQuery = query(
    collection(db, "requests"),
    where("ownerId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const reqSnapshot = await getDocs(reqQuery);

  if (reqSnapshot.empty) {
    container.innerHTML = "<h2>Notifications</h2><p>No notifications found</p>";
    return;
  }

  const usersSnapshot = await getDocs(collection(db, "users"));

  const usersMap = {};
  usersSnapshot.forEach(doc => {
    usersMap[doc.id] = doc.data();
  });

  container.innerHTML = "<h2>Notifications</h2>";

  const returnRequests = [];
  const rentRequests = [];
  const otherRequests = [];

  for (const docSnap of reqSnapshot.docs) {

    const req = docSnap.data();

    // 🔴 AUTO EXPIRE AFTER 2 HOURS
    if (req.status === "pending" && req.createdAt) {

      const createdTime = req.createdAt.toMillis();
      const currentTime = Date.now();

      if (currentTime - createdTime > 7200000) {

        await updateDoc(doc(db, "requests", docSnap.id), {
          status: "expired"
        });

        req.status = "expired";
      }
    }

    const customer = usersMap[req.customerId];
    const customerName = customer ? (customer.name || customer.email) : "Customer";

    const requestData = {
      id: docSnap.id,
      req,
      customerName
    };

    if (req.status === "return_requested") {
      returnRequests.push(requestData);
    }
    else if (req.status === "pending") {
      rentRequests.push(requestData);
    }
    else {
      otherRequests.push(requestData);
    }

  }

  const renderRequest = (item) => {

    const req = item.req;

    let statusText = "";
    let statusColor = "black";

    if (req.status === "pending") {
      statusText = "Pending";
      statusColor = "orange";
    }

    if (req.status === "return_requested") {
      statusText = "Return Requested";
      statusColor = "purple";
    }

    if (req.status === "approved") {
      statusText = "Approved";
      statusColor = "green";
    }

    if (req.status === "rejected") {
      statusText = "Rejected";
      statusColor = "red";
    }

    if (req.status === "returned") {
      statusText = "Returned";
      statusColor = "blue";
    }

    if (req.status === "expired") {
      statusText = "Request Timed Out – No response from owner";
      statusColor = "gray";
    }

    if (req.status === "cancelled") {
      statusText = "Request Cancelled by " + item.customerName;
      statusColor = "darkred";
    }

    container.innerHTML += `
      <div class="request-card">

        <p>
          ${
            req.status === "cancelled"
              ? `<strong>${item.customerName}</strong> cancelled the request for <strong>${req.itemName}</strong>`
              : `<strong>${item.customerName}</strong> wants to rent <strong>${req.itemName}</strong>`
          }
        </p>

        <p><strong>From:</strong> ${req.fromDate}</p>
        <p><strong>To:</strong> ${req.toDate}</p>
        <p><strong>Days:</strong> ${req.days}</p>
        <p><strong>Total Rent:</strong> ₹${req.totalRent}</p>

        <p>
          <strong>Status:</strong> 
          <span style="color:${statusColor}">
            ${statusText}
          </span>
        </p>

        ${
          req.status === "pending"
          ? `
            <button onclick="approveRequest('${item.id}')">Approve</button>
            <button onclick="rejectRequest('${item.id}')">Reject</button>
            `
          : req.status === "return_requested"
          ? `
            <button onclick="acceptReturn('${item.id}', '${req.itemId}')">
              Accept Return
            </button>

            <button onclick="rejectReturn('${item.id}')">
              Reject
            </button>
            `
          : ""
        }

      </div>
    `;
  };

  returnRequests.forEach(renderRequest);
  rentRequests.forEach(renderRequest);
  otherRequests.forEach(renderRequest);

};

window.approveRequest = async function (requestId) {

  const reqSnap = await getDoc(doc(db, "requests", requestId));
  const reqData = reqSnap.data();

  if (!reqData) return;

  // 🔹 Reduce item quantity
  const itemRef = doc(db, "items", reqData.itemId);
  const itemSnap = await getDoc(itemRef);

  if (itemSnap.exists()) {
    const itemData = itemSnap.data();

    await updateDoc(itemRef, {
      quantity: increment(-1)
    });
  }

  // 🔹 Update request status
  await updateDoc(doc(db, "requests", requestId), {
    status: "approved",
    customerNotified: false
  });

  alert("Request approved!");

  openOwnerNotifications(); // refresh properly
};

// ================= REJECT REQUEST =================
window.rejectRequest = async function (requestId) {

  const reqSnap = await getDoc(doc(db, "requests", requestId));
  const reqData = reqSnap.data();

  

  // Update request status
  await updateDoc(doc(db, "requests", requestId), {
  status: "rejected",
  customerNotified: false
});

  alert("Request rejected!");
  openOwnerNotifications();
};

// ================= SHOW CUSTOMER REQUESTS =================
window.showMyRequests = async function () {
  document.getElementById("profileSection").style.display = "none";

  const container = document.getElementById("items");
  if (!container) return;

  container.innerHTML = "<h2 class='items-heading'>My Rental Requests</h2>";

  const user = auth.currentUser;
  if (!user) return;

  const q = query(
    collection(db, "requests"),
    where("customerId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    container.innerHTML += "<p>No rental requests found</p>";
    return;
  }

  snapshot.forEach((docSnap) => {

    const req = docSnap.data();

    let statusText = "";
    let statusColor = "black";

    if (req.status === "approved") {
      statusText = "Accepted";
      statusColor = "green";
    }

    if (req.status === "rejected") {
      statusText = "Rejected";
      statusColor = "red";
    }

    if (req.status === "pending") {
      statusText = "Pending";
      statusColor = "orange";
    }

    if (req.status === "returned") {
      statusText = "Returned";
      statusColor = "blue";
    }

    if (req.status === "return_requested") {
      statusText = "Return Requested";
      statusColor = "purple";
    }

    if (req.status === "cancelled") {
      statusText = "Request Cancelled";
      statusColor = "darkred";
    }

    if (req.status === "expired") {
      statusText = "Request Timed Out – No response from owner";
      statusColor = "gray";
    }

container.innerHTML += `
  <div class="request-card">
    <h3>${req.itemName}</h3>
    <p>Total Rent: ₹${req.totalRent || 0}</p>
    <p>Security Deposit: ₹${req.deposit || 0}</p>
    <p>Owner: ${req.ownerName || "Owner"}</p>
    <p>Status: <strong style="color:${statusColor}">
      ${statusText}
    </strong></p>
  </div>
`;
  });

};

// ================= OWNER NOTIFICATION COUNT =================
function listenOwnerNotifications() {

  const badge = document.getElementById("ownerNotifBadge");
  if (!badge) return;

  const user = auth.currentUser;
  if (!user) return;

  const q = query(
    collection(db, "requests"),
    where("ownerId", "==", user.uid)
  );

  onSnapshot(q, (snapshot) => {

    let count = 0;

    snapshot.forEach((docSnap) => {

      const data = docSnap.data();

      if (data.status === "pending" || data.status === "return_requested") {
        count++;
      }

    });

    if (count > 0) {
      badge.innerText = count;
      badge.style.display = "inline-block";
    } 
    else {
      badge.style.display = "none";
    }

  });

}

// ================= CUSTOMER NOTIFICATION =================
function listenCustomerNotifications() {

  const badge = document.getElementById("notifBadge");
  if (!badge) return;

  const user = auth.currentUser;
  if (!user) return;

  const q = query(
    collection(db, "requests"),
    where("customerId", "==", user.uid)
  );

  onSnapshot(q, (snapshot) => {

    let unreadCount = 0;

    snapshot.forEach((docSnap) => {

      const data = docSnap.data();

      // ignore pending requests
      if (data.status === "pending") return;

      if (data.customerNotified === false) {
        unreadCount++;
      }

    });

    if (unreadCount > 0) {
      badge.innerText = unreadCount;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }

  });

}

async function markNotificationsAsRead() {

  const user = auth.currentUser;
  if (!user) return;

  const q = query(
    collection(db, "requests"),
    where("customerId", "==", user.uid)
  );

  const snapshot = await getDocs(q);

  snapshot.forEach(async (docSnap) => {

    const data = docSnap.data();

    if (data.customerNotified === false && data.status !== "pending") {

      await updateDoc(doc(db, "requests", docSnap.id), {
        customerNotified: true
      });

    }

  });

  const badge = document.getElementById("notifBadge");
  if (badge) badge.style.display = "none";

}

window.enableEditProfile = function () {

  document.getElementById("profileView").style.display = "none";
  document.getElementById("profileEdit").style.display = "block";

  document.getElementById("editName").value =
    document.getElementById("profileName").innerText;

  document.getElementById("editPhone").value =
    document.getElementById("profilePhone").innerText;

  document.getElementById("editAddress").value =
    document.getElementById("profileAddress").innerText;
};

window.saveProfile = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const name = document.getElementById("editName").value;
  const phone = document.getElementById("editPhone").value;
  const address = document.getElementById("editAddress").value;

  if (!name || !phone || !address) {
    alert("Please fill all fields");
    return;
  }

  await updateDoc(doc(db, "users", user.uid), {
    name: name,
    phone: phone,
    address: address
  });

  // update UI
  document.getElementById("profileName").innerText = name;
  document.getElementById("profilePhone").innerText = phone;
  document.getElementById("profileAddress").innerText = address;

  // return to view mode
  document.getElementById("profileView").style.display = "block";
  document.getElementById("profileEdit").style.display = "none";

  alert("Profile updated successfully");
};

function hideOwnerSections() {

  const add = document.getElementById("addForm");
  const edit = document.getElementById("editForm");
  const list = document.getElementById("myItems");
  const profile = document.getElementById("profileSection");

  if (add) add.style.display = "none";
  if (edit) edit.style.display = "none";
  if (profile) profile.style.display = "none";

  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

window.showAddItem = function () {
  hideOwnerSections();
  document.getElementById("addForm").style.display = "block";
};

window.showMyItems = function () {
  hideOwnerSections();
  document.getElementById("myItems").style.display = "block";
  loadOwnerItems();
};

window.editItem = async function (itemId) {

  hideOwnerSections();

  document.getElementById("editForm").style.display = "block";

  const snap = await getDoc(doc(db, "items", itemId));
  const item = snap.data();

  // Store item ID
  document.getElementById("editItemId").value = itemId;

  // Fill previous data
  document.getElementById("edit_name").value = item.name || "";
  document.getElementById("edit_price").value = item.price || "";
  document.getElementById("edit_deposit").value = item.deposit || "";
  document.getElementById("edit_brand").value = item.brand || "";
  document.getElementById("edit_features").value = item.features || "";
  document.getElementById("edit_quantity").value = item.quantity || "";
};

window.saveItemChanges = async function () {

  const itemId = document.getElementById("editItemId").value;

  await updateDoc(doc(db, "items", itemId), {
    name: document.getElementById("edit_name").value,
    price: Number(document.getElementById("edit_price").value),
    deposit: Number(document.getElementById("edit_deposit").value),
    brand: document.getElementById("edit_brand").value,
    features: document.getElementById("edit_features").value,
    quantity: Number(document.getElementById("edit_quantity").value)
  });

  alert("Item updated successfully");

  hideOwnerSections();
  showMyItems();
};

window.cancelEdit = function () {
  hideOwnerSections();
  showMyItems();
};

window.removeItem = async function (itemId) {

  if (!confirm("Are you sure you want to delete this item?")) return;

  await deleteDoc(doc(db, "items", itemId));

  alert("Item deleted successfully");
  loadOwnerItems();
};

async function loadHeaderName(user) {

  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (!userDoc.exists()) return;

  const data = userDoc.data();

  const nameSpan = document.getElementById("currentUser");

  if (nameSpan) {
    nameSpan.innerText = data.name || user.email;
  }
}

function setupDateLimits() {

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const oneMonthLater = new Date();
  oneMonthLater.setMonth(today.getMonth() + 1);
  const oneMonthStr = oneMonthLater.toISOString().split("T")[0];

  const fromInput = document.getElementById("rentFrom");
  const toInput = document.getElementById("rentTo");

  if (!fromInput || !toInput) return;

  // FROM DATE restrictions
  fromInput.min = todayStr;
  fromInput.max = oneMonthStr;

  // TO DATE restrictions
  toInput.min = todayStr;
}

function calculateRentDetails() {

  const fromDate = document.getElementById("rentFrom").value;
  const toDate = document.getElementById("rentTo").value;

  if (!fromDate || !toDate) return;

  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (to < from) {
    alert("To Date cannot be before From Date");
    return;
  }

  const diffTime = to - from;
  const days = (diffTime / (1000 * 60 * 60 * 24)) + 1;

  const totalRent = days * selectedItemData.price;

  document.getElementById("rentSummary").innerHTML = `
    Total Days: ${days} <br>
    Total Rent: ₹${totalRent}
  `;
}

document.addEventListener("change", function (e) {

  if (e.target.id === "rentFrom" || e.target.id === "rentTo") {
    calculateRentDetails();
  }

});
// ================= OWNER RENTAL HISTORY =================

window.showOwnerHistory = async function () {

  hideOwnerSections();

  const container = document.getElementById("myItems");
  if (!container) return;

  container.style.display = "block";
  container.innerHTML = "<h2>Rental History</h2><p>Loading...</p>";

  const user = auth.currentUser;
  if (!user) return;

  const reqQuery = query(
    collection(db, "requests"),
    where("ownerId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const reqSnapshot = await getDocs(reqQuery);

  if (reqSnapshot.empty) {
    container.innerHTML = "<h2>Rental History</h2><p>No rental history found</p>";
    return;
  }

  // GET ITEMS ONCE
  const itemsSnapshot = await getDocs(collection(db, "items"));
  const itemsMap = {};

  itemsSnapshot.forEach(doc => {
    itemsMap[doc.id] = doc.data();
  });

  // GET USERS ONCE
  const usersSnapshot = await getDocs(collection(db, "users"));
  const usersMap = {};

  usersSnapshot.forEach(doc => {
    usersMap[doc.id] = doc.data();
  });

  container.innerHTML = "<h2>Rental History</h2>";

  reqSnapshot.forEach(docSnap => {

    const req = docSnap.data();

    const item = itemsMap[req.itemId];
    const userData = usersMap[req.customerId];

    const image = item ? item.imageBase64 : "";
    const customerName = userData ? (userData.name || userData.email) : "Customer";
    

    let statusText = "";
    let statusColor = "black";

    if (req.status === "approved") {
      statusText = "Accepted";
      statusColor = "green";
    }

    if (req.status === "rejected") {
      statusText = "Rejected";
      statusColor = "red";
    }

    if (req.status === "pending") {
      statusText = "Pending";
      statusColor = "orange";
    }

    if (req.status === "returned") {
      statusText = "Returned";
      statusColor = "blue";
    }

    if (req.status === "return_requested") {
      statusText = "Return Requested";
      statusColor = "purple";
    }

    if (req.status === "cancelled") {
      statusText = "Request Cancelled by Customer";
      statusColor = "darkred";
    }

    if (req.status === "expired") {
      statusText = "Request Timed Out – No response from owner";
      statusColor = "gray";
    }
    container.innerHTML += `
      <div class="item-card">

        <div class="item-left">
          <img src="${image}">
        </div>

        <div class="item-right">

          <p><strong>Item:</strong> ${req.itemName}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p>
            <strong>Status:</strong>
            <span style="color:${statusColor}; font-weight:bold;">
              ${statusText}
            </span>
          </p>

        </div>

      </div>
    `;

  });

};

window.openCustomerNotifications = async function () {

  customerRenderToken++;
  const token = customerRenderToken;

  currentCustomerView = "notifications";
  hideCustomerSections();

  const container = document.getElementById("items");
  if (!container) return;

  container.innerHTML = "<h2>Notifications</h2>";

  const user = auth.currentUser;
  if (!user) return;

  const q = query(
    collection(db, "requests"),
    where("customerId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  if (token !== customerRenderToken) return;

  if (snapshot.empty) {
    container.innerHTML += "<p>No notifications found</p>";
  }

  snapshot.forEach((docSnap) => {

    if (token !== customerRenderToken) return;

    const req = docSnap.data();
    let message = "";

    if (req.penaltyAmount > 0 && req.status === "approved") {

      message = `
        Late return penalty has been applied for 
        "<strong>${req.itemName}</strong>"<br>
        <span style="color:red;font-weight:bold;">
          Penalty: ₹${req.penaltyAmount}
        </span>
      `;

    } 
    else if (req.status === "approved") {

      message = `
        Your request for "<strong>${req.itemName}</strong>" has been 
        <strong style="color:green">Accepted</strong>
      `;

    } 
    else if (req.status === "rejected") {

      message = `
        Your request for "<strong>${req.itemName}</strong>" has been 
        <strong style="color:red">Rejected</strong>
      `;

    }

    if (message !== "") {

      container.innerHTML += `
        <div class="request-card">
          ${message}
        </div>
      `;

    }

  });

  // 🔹 Mark unread notifications as read
  // 🔹 Mark only real notifications as read (NOT pending requests)
const unreadQuery = query(
  collection(db, "requests"),
  where("customerId", "==", user.uid),
  where("customerNotified", "==", false)
);

const unreadSnap = await getDocs(unreadQuery);

const updates = [];

unreadSnap.forEach((docSnap) => {

  updates.push(
    updateDoc(doc(db, "requests", docSnap.id), {
      customerNotified: true
    })
  );

});

await Promise.all(updates);

};

// ================= CUSTOMER RENTAL HISTORY =================

window.showCustomerHistory = async function () {

  customerRenderToken++;
  const token = customerRenderToken;

  const container = document.getElementById("items");
  if (!container) return;

  document.getElementById("profileSection").style.display = "none";

  container.innerHTML = "<h2>Rental History</h2><p>Loading...</p>";

  const user = auth.currentUser;
  if (!user) return;

  const reqQuery = query(
    collection(db, "requests"),
    where("customerId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const reqSnapshot = await getDocs(reqQuery);

  if (token !== customerRenderToken) return;

  if (reqSnapshot.empty) {
    container.innerHTML = "<h2>Rental History</h2><p>No rental history found</p>";
    return;
  }

  const itemsSnapshot = await getDocs(collection(db, "items"));

  const itemsMap = {};
  itemsSnapshot.forEach(doc => {
    itemsMap[doc.id] = doc.data();
  });

  container.innerHTML = "<h2>Rental History</h2>";

  for (const docSnap of reqSnapshot.docs) {

    const req = docSnap.data();

    // 🔴 AUTO EXPIRE AFTER 2 HOURS
    if (req.status === "pending" && req.createdAt) {

      const createdTime = req.createdAt.toMillis();
      const currentTime = Date.now();

      if (currentTime - createdTime > 3600000) {

        await updateDoc(doc(db, "requests", docSnap.id), {
          status: "expired"
        });

        req.status = "expired";
      }
    }

    const item = itemsMap[req.itemId];
    let image = item ? item.imageBase64 : "";

    let statusText = "";
    let statusColor = "black";

    if (req.status === "approved") {
      statusText = "Accepted";
      statusColor = "green";
    }

    if (req.status === "rejected") {
      statusText = "Rejected";
      statusColor = "red";
    }

    if (req.status === "pending") {
      statusText = "Pending";
      statusColor = "orange";
    }

    if (req.status === "returned") {
      statusText = "Returned";
      statusColor = "blue";
    }

    if (req.status === "return_requested") {
      statusText = "Return Requested";
      statusColor = "purple";
    }

    if (req.status === "cancelled") {
      statusText = "Request Cancelled";
      statusColor = "darkred";
    }

    if (req.status === "expired") {
      statusText = "Request Timed Out – No response from owner";
      statusColor = "gray";
    }

    container.innerHTML += `
      <div class="item-card">

        <div class="item-left">
          <img src="${image}" alt="Item Image">
        </div>

        <div class="item-right">

          <p><strong>Item:</strong> ${req.itemName}</p>
          <p><strong>Owner:</strong> ${req.ownerName || "Owner"}</p>
          <p><strong>From:</strong> ${req.fromDate}</p>
          <p><strong>To:</strong> ${req.toDate}</p>
          <p><strong>Days:</strong> ${req.days}</p>
          <p><strong>Total Rent:</strong> ₹${req.totalRent || 0}</p>

          <p>
            <strong>Status:</strong>
            <span style="color:${statusColor}">
              ${statusText}
            </span>
          </p>

          ${
            req.penaltyAmount > 0 && req.status === "approved"
            ? `<p style="color:red;font-weight:bold;">
                  Late Return Penalty: ₹${req.penaltyAmount}
              </p>`
            : ""
          }

          ${
            req.status === "pending"
            ? `<button onclick="cancelRequest('${docSnap.id}')"
                  style="background:#ff4d4d;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;">
                  Cancel Request
              </button>`
            : req.status === "approved"
            ? `<button onclick="requestReturn('${docSnap.id}')">
                  Return Request
              </button>`
            : req.status === "return_requested"
            ? `<p style="color:orange;font-weight:bold;">
                  Return request sent. Waiting for owner approval
              </p>`
            : ""
          }

        </div>

      </div>
    `;
  }

};

function hideCustomerSections() {

  const container = document.getElementById("items");
  const profileDiv = document.getElementById("profileSection");

  if (container) {
    container.innerHTML = "";
    container.style.display = "block";
  }
  if (profileDiv) profileDiv.style.display = "none";
}

window.requestReturn = async function (requestId) {

  const requestRef = doc(db, "requests", requestId);

  await updateDoc(requestRef, {
    status: "return_requested"
  });

  alert("Return request sent to owner");

  showCustomerHistory();
};

async function checkLateReturns(userId) {

  const q = query(
    collection(db, "requests"),
    where("customerId", "==", userId),
    where("status", "==", "approved")
  );

  const snapshot = await getDocs(q);

  const today = new Date();
  today.setHours(0,0,0,0);

  for (const docSnap of snapshot.docs) {

    const data = docSnap.data();

    let endDate = new Date(data.toDate);
    endDate.setHours(0,0,0,0);

    if (today > endDate) {

      let lateDays = Math.floor(
        (today - endDate) / (1000 * 60 * 60 * 24)
      );

      let rentPerDay = data.totalRent / data.days;

      let penalty = 200 + (lateDays * rentPerDay);

      // ✅ ONLY update if penalty increased
      if (penalty > (data.penaltyAmount || 0)) {

        await updateDoc(doc(db, "requests", docSnap.id), {
          penaltyAmount: penalty,
          customerNotified: false
        });

      }

    }

  }

}

function getStars(rating) {

  let stars = "";

  for (let i = 1; i <= 5; i++) {

    if (i <= rating) {
      stars += `<span style="color:gold;">★</span>`;
    } 
    else {
      stars += `<span style="color:#ccc;">★</span>`;
    }

  }

  return `<span class="review-stars">${stars}</span>`;
}

window.viewReviews = async function (itemId) {

  const itemsContainer = document.getElementById("items");
  const reviewsSection = document.getElementById("reviewsSection");

  itemsContainer.style.display = "none";
  reviewsSection.style.display = "block";
  reviewsSection.innerHTML = "Loading...";

  const itemDoc = await getDoc(doc(db, "items", itemId));
  const itemName = itemDoc.data().name;

  const q = query(
    collection(db, "reviews"),
    where("itemId", "==", itemId)
  );

  const snapshot = await getDocs(q);

  let html = `<h2>Reviews for ${itemName}</h2><br>`;

  if (snapshot.empty) {
    html += `<p>No reviews yet</p>`;
  } else {

    for (const reviewDoc of snapshot.docs) {

      const data = reviewDoc.data();

      // 🔥 FETCH CUSTOMER NAME FROM USERS COLLECTION
      const userSnap = await getDoc(doc(db, "users", data.customerId));

      let customerName = "Unknown User";

      if (userSnap.exists()) {
        customerName = userSnap.data().name || userSnap.data().email;
      }

      let formattedDate = "";

      const reviewDate = data.createdAt || data.updatedAt;

      if (reviewDate) {

        const dateObj = reviewDate.toDate
          ? reviewDate.toDate()
          : new Date(reviewDate);

        formattedDate = dateObj.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });

      }

      html += `
        <div style="margin-bottom:20px; padding:10px; border:1px solid #ddd;">
          <strong>${customerName}</strong><br>
          Rating: ${getStars(data.rating)} (${data.rating}/5)<br>
          Comment: ${data.comment}<br>
          Date: ${formattedDate}
        </div>
      `;
    }
  }

  html += `<button onclick="backToItems()">Back</button>`;

  reviewsSection.innerHTML = html;
};

window.backToItems = function () {
  document.getElementById("reviewsSection").style.display = "none";
  document.getElementById("items").style.display = "block";
};

window.addReview = function(itemId) {

  const container = document.getElementById("items");

  container.innerHTML += `
  
  <div id="reviewPopup" 
       style="position:fixed; top:0; left:0; width:100%; height:100%;
              background:rgba(0,0,0,0.4);
              display:flex; align-items:center; justify-content:center;">

    <div style="
background:white;
padding:25px;
width:350px;
border-radius:10px;
box-shadow:0 0 15px rgba(0,0,0,0.3);
">

      <h3>Review Product</h3>

      <label>Rating</label><br>

<div id="starRating" style="font-size:25px; cursor:pointer; margin-bottom:10px;">
  <span onclick="setRating(1)">☆</span>
  <span onclick="setRating(2)">☆</span>
  <span onclick="setRating(3)">☆</span>
  <span onclick="setRating(4)">☆</span>
  <span onclick="setRating(5)">☆</span>
</div>

<input type="hidden" id="reviewRating">

      <label>Comment</label><br>
      <textarea id="reviewComment" style="width:100%; margin-bottom:15px;"></textarea>

      <div style="display:flex; gap:10px;">

        <button onclick="submitReview('${itemId}')">
          Save
        </button>

        <button onclick="closeReviewPopup()">
          Cancel
        </button>

      </div>

    </div>

  </div>
  `;
};

window.setRating = function(rating) {

  const stars = document.querySelectorAll("#starRating span");

  stars.forEach((star, index) => {

    if (index < rating) {
      star.innerHTML = "★";
      star.style.color = "gold";
    } else {
      star.innerHTML = "☆";
      star.style.color = "black";
    }

  });

  document.getElementById("reviewRating").value = rating;
};

window.submitReview = async function(itemId) {

  const rating = document.getElementById("reviewRating").value;
  const comment = document.getElementById("reviewComment").value;

  if (!rating || !comment) {
    alert("Please enter rating and comment");
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  const userSnap = await getDoc(doc(db, "users", user.uid));

  let customerName = "User";

  if (userSnap.exists()) {
    customerName = userSnap.data().name || userSnap.data().email;
  }

  await addDoc(collection(db, "reviews"), {
    itemId: itemId,
    customerId: user.uid,
    customerName: customerName,
    rating: Number(rating),
    comment: comment,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  alert("Review Added");

  closeReviewPopup();

  showCustomerHistory();
};

window.closeReviewPopup = function() {

  const popup = document.getElementById("reviewPopup");

  if (popup) {
    popup.remove();
  }

};

window.editReview = async function(reviewId) {

  const reviewDoc = await getDoc(doc(db, "reviews", reviewId));
  const data = reviewDoc.data();

  const container = document.getElementById("items");

  container.innerHTML += `
  
  <div id="reviewPopup" 
       style="position:fixed; top:0; left:0; width:100%; height:100%;
              background:rgba(0,0,0,0.4);
              display:flex; align-items:center; justify-content:center;">

    <div style="
background:white;
padding:25px;
width:350px;
border-radius:10px;
box-shadow:0 0 15px rgba(0,0,0,0.3);
">

      <h3>Edit Review</h3>

      <label>Rating</label><br>

      <div id="starRating" style="font-size:25px; cursor:pointer; margin-bottom:10px;">
        <span onclick="setRating(1)">☆</span>
        <span onclick="setRating(2)">☆</span>
        <span onclick="setRating(3)">☆</span>
        <span onclick="setRating(4)">☆</span>
        <span onclick="setRating(5)">☆</span>
      </div>

      <input type="hidden" id="reviewRating" value="${data.rating}">

      <label>Comment</label><br>
      <textarea id="reviewComment" style="width:100%; margin-bottom:15px;">${data.comment}</textarea>

      <div style="display:flex; gap:10px;">

        <button onclick="updateReview('${reviewId}')">
          Save
        </button>

        <button onclick="closeReviewPopup()">
          Cancel
        </button>

      </div>

    </div>

  </div>
  `;

  // ⭐ Show previous rating
  setRating(data.rating);
};

window.updateReview = async function(reviewId) {

  const rating = document.getElementById("reviewRating").value;
  const comment = document.getElementById("reviewComment").value;

  if (!rating || !comment) {
    alert("Please enter rating and comment");
    return;
  }

  await updateDoc(doc(db, "reviews", reviewId), {
    rating: Number(rating),
    comment: comment,
    updatedAt: serverTimestamp()
  });

  alert("Review Updated");

  closeReviewPopup();

  showCustomerHistory();
};

window.deleteReview = async function(reviewId) {

  const confirmDelete = confirm("Are you sure?");

  if (!confirmDelete) return;

  await deleteDoc(doc(db, "reviews", reviewId));

  alert("Review Deleted");
  showCustomerHistory();
};

window.saveReview = async function (itemId, rating, comment) {

  const user = auth.currentUser;
  if (!user) return;

  // Get customer profile name
  const profileSnap = await getDoc(doc(db, "users", user.uid));
  let customerName = "User";

  if (profileSnap.exists()) {
    customerName = profileSnap.data().name || "User";
  }

  // Check if review already exists
  const q = query(
    collection(db, "reviews"),
    where("itemId", "==", itemId),
    where("customerId", "==", user.uid)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    // UPDATE REVIEW
    const reviewId = snapshot.docs[0].id;

    await updateDoc(doc(db, "reviews", reviewId), {
      rating: Number(rating),
      comment: comment,
      customerName: customerName,
      updatedAt: serverTimestamp()
    });

  } else {
    // ADD REVIEW
    await addDoc(collection(db, "reviews"), {
      itemId: itemId,
      customerId: user.uid,
      customerName: customerName,
      rating: Number(rating),
      comment: comment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  alert("Review saved successfully");
};

window.searchOwnerItems = function () {

  const input = document.getElementById("ownerSearch").value.toLowerCase();
  const cards = document.querySelectorAll("#myItems .item-card");

  cards.forEach(card => {

    const name = card.querySelector("h2").innerText.toLowerCase();

    if (name.includes(input)) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }

  });

};

window.searchCustomerItems = function () {

  const input = document.getElementById("customerSearch").value.toLowerCase();
  const cards = document.querySelectorAll("#items .item-card");

  cards.forEach(card => {

    const name = card.querySelector("h2").innerText.toLowerCase();

    if (name.includes(input)) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }

  });

};

window.filterItems = function () {

  const filter = document.getElementById("itemFilter").value;
  const container = document.getElementById("items");

  const cards = Array.from(container.querySelectorAll(".item-card"));

  if (filter === "low-high") {

    cards.sort((a, b) =>
      Number(a.dataset.price) - Number(b.dataset.price)
    );

  }

  if (filter === "high-low") {

    cards.sort((a, b) =>
      Number(b.dataset.price) - Number(a.dataset.price)
    );

  }

  if (filter === "available") {

    cards.sort((a, b) =>
      Number(b.dataset.qty) - Number(a.dataset.qty)
    );

  }

  cards.forEach(card => container.appendChild(card));

};

window.acceptReturn = async function (requestId, itemId) {

  await updateDoc(doc(db, "requests", requestId), {
    status: "returned",
    returnedAt: new Date()
  });

  await updateDoc(doc(db, "items", itemId), {
    quantity: increment(1)
  });

  alert("Item marked as returned");

  openOwnerNotifications();
};

window.rejectReturn = async function (requestId) {

  await updateDoc(doc(db, "requests", requestId), {
    status: "approved"
  });

  alert("Return request rejected");

  openOwnerNotifications();
};

window.cancelRequest = async function (requestId) {

  const confirmCancel = confirm("Are you sure you want to cancel this request?");
  if (!confirmCancel) return;

  await updateDoc(doc(db, "requests", requestId), {
    status: "cancelled"
  });

  alert("Request cancelled successfully");

  showCustomerHistory();
};