const APP_VERSION = "ver1.0.0";
const BUILD_ID = "20260917-1";
const STORAGE_KEY = "hafize-tracker-state-v1";
const FIREBASE_CONFIG_STORAGE_KEY = "hafize-firebase-config-v1";

const FIREBASE_VERSION = "10.12.4";
const FIREBASE_URLS = {
  app: `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`,
  auth: `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`,
  firestore: `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`
};

const PROJECT_SERIES = {
  "Konvensional Dalaman": [
    "Daftar projek",
    "Semakan skop dalaman",
    "Penyediaan dokumen",
    "Semakan kelulusan",
    "Serahan untuk tindakan"
  ],
  "Konvensional Perunding": [
    "Keperluan perunding",
    "Lantikan perunding",
    "Reka bentuk awal",
    "Semakan dokumen tender",
    "Pengesahan akhir"
  ],
  "Reka & Bina": [
    "Pra-kelayakan",
    "Cadangan teknikal",
    "Penilaian reka & bina",
    "Rundingan harga",
    "Surat setuju terima"
  ]
};

const PROGRESS_SERIES = {
  "Konvensional Dalaman": {
    "Rundingan 20A": [
      "Semakan dokumen rundingan",
      "Jadual rundingan",
      "Keputusan rundingan",
      "Kelulusan rundingan"
    ],
    "Pelaksanaan Dalaman": [
      "Arahan mula kerja",
      "Pemantauan kemajuan",
      "Bayaran kemajuan",
      "Serahan akhir"
    ]
  },
  "Konvensional Perunding": {
    "Pengesyoran Perunding": [
      "Senarai pendek",
      "Penilaian perunding",
      "Pengesyoran jawatankuasa",
      "Kelulusan pelantikan"
    ],
    "Pelaksanaan Perunding": [
      "Reka bentuk terperinci",
      "Semakan teknikal",
      "Dokumen tender",
      "Laporan akhir"
    ]
  },
  "Reka & Bina": {
    "Pengesyoran Perunding": [
      "Semakan cadangan",
      "Penilaian perunding",
      "Pengesyoran teknikal",
      "Kelulusan pelantikan"
    ],
    "Pelaksanaan Reka & Bina": [
      "Dokumen RFP",
      "Penilaian reka bentuk",
      "Kemajuan pembinaan",
      "Pentauliahan dan serahan"
    ]
  }
};

const TRACKING_STATUSES = ["Not Started", "In Progress", "Pending Review", "Completed", "Blocked"];
const FILE_STATUSES = ["Running", "Closed"];
const PROJECT_MASTER_STATUSES = ["Aktif", "Serah"];
const PELAKSANAAN_OPTIONS = Object.keys(PROJECT_SERIES);
const PROJECT_EXCEL_HEADERS = ["Bil", "Project Name", "Project Code", "Status", "Pelaksanaan"];
const PROJECT_EXCEL_SHEET_NAME = "List of Projects";
const EXCEL_COVER_SHEET_NAME = "Muka Depan";
const EXCEL_CONFIRMATION_SHEET_NAME = "Pengesahan";
const JKR_LOGO_PATH = "./assets/jkr-logo.png";
const VEHICLE_INFO_DOC_ID = "vehicle-project-info";
const VEHICLE_INFO_TYPE = "vehicleProjectInfo";
const VEHICLE_INFO_DEFAULTS = {
  projectName: "",
  contractNo: "",
  contractor: "",
  driverNamePhone: "",
  vehicleRegistration: "",
  vehicleType: "",
  responsibleOfficer: "",
  officeName: "CAWANGAN KEJURUTERAAN AWAM DAN STRUKTUR",
  reviewYear: String(new Date().getFullYear())
};
const CONFIRMATION_MONTHS = [
  "JANUARI",
  "FEBRUARI",
  "MAC",
  "APRIL",
  "MEI",
  "JUN",
  "JULAI",
  "OGOS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DISEMBER"
];

const SEEDED_RECORD_PREFIX = "sample-";

const state = {
  activeView: "overview",
  authMode: "signin",
  mode: "local",
  firebaseConfigured: false,
  firebaseReady: false,
  sdk: null,
  app: null,
  db: null,
  auth: null,
  user: null,
  profile: null,
  masterProjects: [],
  items: [],
  users: [],
  vehicleInfo: { ...VEHICLE_INFO_DEFAULTS },
  filter: "",
  fileLocationSearch: "",
  lastProjectSave: null,
  lastVehicleInfoSave: null,
  lastTrackerSave: {
    file: null,
    project: null,
    progress: null
  },
  sync: {
    label: "Starting",
    tone: "idle",
    updatedAt: Date.now()
  },
  unsubscribers: []
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  hydrateFromHash();
  renderShell();

  const firebaseConfig = getFirebaseConfig();
  state.firebaseConfigured = isFirebaseConfigured(firebaseConfig);

  if (state.firebaseConfigured) {
    await startFirebase(firebaseConfig);
  } else {
    startLocalMode("Firebase setup needed");
  }
}

function cacheElements() {
  els.appView = document.querySelector("#appView");
  els.viewTitle = document.querySelector("#viewTitle");
  els.viewEyebrow = document.querySelector("#viewEyebrow");
  els.syncIndicator = document.querySelector("#syncIndicator");
  els.syncLabel = document.querySelector("#syncLabel");
  els.modePill = document.querySelector("#modePill");
  els.navItems = [...document.querySelectorAll(".nav-item")];
}

function bindEvents() {
  window.addEventListener("error", (event) => {
    reportRuntimeError(event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportRuntimeError(event.reason);
  });

  window.addEventListener("hashchange", () => {
    hydrateFromHash();
    renderShell();
  });

  window.addEventListener("online", () => {
    setSync(state.mode === "firebase" ? "Online" : "Local mode", state.mode === "firebase" ? "online" : "local");
  });

  window.addEventListener("offline", () => {
    setSync("Offline", "offline");
  });

  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
}

function hydrateFromHash() {
  const view = window.location.hash.replace("#", "");
  state.activeView = ["overview", "projectList", "files", "projects", "progress", "team"].includes(view)
    ? view
    : "overview";
}

async function startFirebase(firebaseConfig) {
  state.mode = "firebase";
  setSync("Connecting", "saving");
  renderShell();

  try {
    const [firebaseApp, firebaseAuth, firebaseFirestore] = await Promise.all([
      import(FIREBASE_URLS.app),
      import(FIREBASE_URLS.auth),
      import(FIREBASE_URLS.firestore)
    ]);

    state.sdk = {
      ...firebaseApp,
      ...firebaseAuth,
      ...firebaseFirestore
    };

    state.app = state.sdk.initializeApp(firebaseConfig);
    state.auth = state.sdk.getAuth(state.app);
    state.db = state.sdk.getFirestore(state.app);
    state.firebaseReady = true;

    state.sdk.onAuthStateChanged(state.auth, async (user) => {
      clearSubscriptions();
      state.user = user;

      if (!user) {
        state.profile = null;
        state.masterProjects = [];
        state.items = [];
        state.users = [];
        state.vehicleInfo = { ...VEHICLE_INFO_DEFAULTS };
        setSync("Signed out", "idle");
        renderShell();
        return;
      }

      try {
        setSync("Preparing account", "saving");
        await ensureUserProfile(user);
        subscribeToData();
        renderShell();
      } catch (error) {
        console.error(error);
        setSync(friendlyFirebaseError(error), "error");
        renderShell();
      }
    });
  } catch (error) {
    console.error(error);
    startLocalMode("Firebase unavailable");
  }
}

function startLocalMode(label) {
  state.mode = "local";
  state.firebaseReady = false;
  state.user = {
    uid: "local-admin",
    email: "admin@hafize.local",
    displayName: "Admin Hafize"
  };
  state.profile = {
    id: "local-admin",
    displayName: "Admin Hafize",
    email: "admin@hafize.local",
    role: "admin",
    status: "active"
  };

  const saved = safeJsonParse(localStorage.getItem(STORAGE_KEY), null);
  const hasSavedData = Boolean(
    saved &&
      (Array.isArray(saved.masterProjects) ||
        Array.isArray(saved.items) ||
        Array.isArray(saved.users) ||
        saved.vehicleInfo)
  );

  if (hasSavedData) {
    state.masterProjects = Array.isArray(saved?.masterProjects)
      ? saved.masterProjects.map(normalizeMasterProject).filter((project) => !isSeededRecord(project))
      : [];
    state.items = Array.isArray(saved?.items)
      ? saved.items.map(normalizeTrackerItem).filter((item) => !isSeededRecord(item))
      : [];
    state.users = Array.isArray(saved?.users) && saved.users.length
      ? saved.users.filter((user) => !isSeededRecord(user))
      : [state.profile];
    state.vehicleInfo = normalizeVehicleProjectInfo(saved?.vehicleInfo);
    persistLocal();
  } else {
    state.masterProjects = [];
    state.items = [];
    state.users = [state.profile];
    state.vehicleInfo = { ...VEHICLE_INFO_DEFAULTS };
    persistLocal();
  }

  setSync(label, "local");
  renderShell();
}

async function ensureUserProfile(user) {
  const userRef = state.sdk.doc(state.db, "users", user.uid);
  const userSnapshot = await state.sdk.getDoc(userRef);
  const configuredAdmin = isConfiguredAdminUser(user);

  if (userSnapshot.exists()) {
    const profileData = normalizeFirebaseData(userSnapshot.data());
    state.profile = {
      id: user.uid,
      ...profileData,
      ...(configuredAdmin ? { role: "admin", status: "active" } : {})
    };
    const profileUpdate = configuredAdmin
      ? {
          role: "admin",
          status: "active",
          lastSeenAt: state.sdk.serverTimestamp()
        }
      : {
          lastSeenAt: state.sdk.serverTimestamp()
        };
    try {
      await state.sdk.updateDoc(userRef, profileUpdate);
    } catch (error) {
      console.error(error);
      setSync(friendlyFirebaseError(error), "error");
    }
    return;
  }

  const role = configuredAdmin ? "admin" : "colleague";
  const profile = {
    displayName: user.displayName || user.email?.split("@")[0] || "Team member",
    email: user.email || "",
    role,
    status: "active",
    createdAt: state.sdk.serverTimestamp(),
    lastSeenAt: state.sdk.serverTimestamp()
  };

  await state.sdk.setDoc(userRef, profile);
  state.profile = {
    id: user.uid,
    ...profile,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
}

function subscribeToData() {
  const masterProjectQuery = state.sdk.query(
    state.sdk.collection(state.db, "masterProjects"),
    state.sdk.orderBy("projectName", "asc")
  );
  const itemQuery = state.sdk.query(
    state.sdk.collection(state.db, "trackerItems"),
    state.sdk.orderBy("updatedAt", "desc")
  );
  const userQuery = state.sdk.query(
    state.sdk.collection(state.db, "users"),
    state.sdk.orderBy("displayName", "asc")
  );

  const unsubscribeItems = state.sdk.onSnapshot(
    itemQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      const docs = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...normalizeFirebaseData(docSnapshot.data())
      }));
      const seededIds = docs.filter(isSeededRecord).map((doc) => doc.id);
      const vehicleInfoDoc = docs.find(isVehicleProjectInfoRecord);
      state.vehicleInfo = normalizeVehicleProjectInfo(vehicleInfoDoc);
      state.items = docs
        .filter((doc) => !isSeededRecord(doc) && !isVehicleProjectInfoRecord(doc))
        .map(normalizeTrackerItem);
      deleteSeededDocuments("trackerItems", seededIds);

      setPassiveSync(snapshot.metadata.hasPendingWrites ? "Saving" : "Synced", snapshot.metadata.hasPendingWrites ? "saving" : "online");
      renderView();
    },
    (error) => {
      console.error(error);
      setSync(friendlyFirebaseError(error), "error");
    }
  );

  const unsubscribeMasterProjects = state.sdk.onSnapshot(
    masterProjectQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      const docs = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...normalizeFirebaseData(docSnapshot.data())
      }));
      const seededIds = docs.filter(isSeededRecord).map((doc) => doc.id);
      state.masterProjects = docs.filter((doc) => !isSeededRecord(doc)).map(normalizeMasterProject);
      deleteSeededDocuments("masterProjects", seededIds);

      setPassiveSync(snapshot.metadata.hasPendingWrites ? "Saving" : "Synced", snapshot.metadata.hasPendingWrites ? "saving" : "online");
      renderShell();
    },
    (error) => {
      console.error(error);
      setSync(friendlyFirebaseError(error), "error");
    }
  );

  const unsubscribeUsers = state.sdk.onSnapshot(
    userQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      state.users = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...normalizeFirebaseData(docSnapshot.data())
      })).filter((member) => !isSeededRecord(member));

      const currentProfile = state.users.find((member) => member.id === state.user?.uid);
      if (currentProfile) {
        state.profile = currentProfile;
      }

      renderShell();
    },
    (error) => {
      console.error(error);
      setSync(friendlyFirebaseError(error), "error");
    }
  );

  state.unsubscribers = [unsubscribeItems, unsubscribeUsers, unsubscribeMasterProjects];
}

function clearSubscriptions() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
}

function handleClick(event) {
  const navItem = event.target.closest("[data-view]");
  if (navItem) {
    window.location.hash = navItem.dataset.view;
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const { action } = actionButton.dataset;

  if (action === "sign-out") {
    signOut();
  }

  if (action === "toggle-auth") {
    state.authMode = state.authMode === "signin" ? "signup" : "signin";
    renderView();
  }

  if (action === "clear-mobile-search") {
    state.filter = "";
    renderView();
  }

  if (action === "select-search-project") {
    selectSearchProject(actionButton);
  }

  if (action === "edit-master-project") {
    loadMasterProjectIntoForm(actionButton.dataset.id);
  }

  if (action === "delete-master-project") {
    deleteMasterProject(actionButton.dataset.id);
  }

  if (action === "edit-item") {
    loadItemIntoForm(actionButton.dataset.id);
  }

  if (action === "delete-item") {
    deleteItem(actionButton.dataset.id);
  }

  if (action === "start-series") {
    startSeries(actionButton.dataset.seriesType);
  }

  if (action === "clear-local-data") {
    clearLocalData();
  }

  if (action === "copy-config-template") {
    copyConfigTemplate();
  }

  if (action === "download-project-excel") {
    event.preventDefault();
    downloadProjectExcel();
  }

  if (action === "choose-project-excel") {
    event.preventDefault();
    chooseProjectExcelFile();
  }

  if (action === "save-vehicle-info") {
    event.preventDefault();
    const form = actionButton.closest("form");
    if (form) {
      saveVehicleProjectInfo(form);
    }
  }

  if (action === "save-master-project") {
    event.preventDefault();
    const form = actionButton.closest("form");
    if (form) {
      saveMasterProject(form);
    }
  }

  if (action === "save-file-item") {
    event.preventDefault();
    const form = actionButton.closest("form");
    if (form) {
      saveFileItem(form);
    }
  }

  if (action === "save-project-item") {
    event.preventDefault();
    const form = actionButton.closest("form");
    if (form) {
      saveProjectItem(form);
    }
  }

  if (action === "save-progress-item") {
    event.preventDefault();
    const form = actionButton.closest("form");
    if (form) {
      saveProgressItem(form);
    }
  }
}

function handleInput(event) {
  const mobileLookupSearch = event.target.closest("[data-mobile-lookup-search]");
  if (mobileLookupSearch) {
    updateMobileLookupSearch(mobileLookupSearch);
    return;
  }

  const fileLocationSearch = event.target.closest("[data-file-location-search]");
  if (fileLocationSearch) {
    updateFileLocationSearchControls(fileLocationSearch);
    return;
  }

  const projectSearch = event.target.closest("[data-master-project-search]");
  if (projectSearch) {
    updateMasterProjectSearchControls(projectSearch);
  }
}

function handleChange(event) {
  const projectExcelUpload = event.target.closest("[data-project-excel-upload]");
  if (projectExcelUpload) {
    importProjectExcel(projectExcelUpload);
    return;
  }

  const projectSearch = event.target.closest("[data-master-project-search]");
  if (projectSearch) {
    updateMasterProjectSearchControls(projectSearch);
    return;
  }

  const masterProjectSelect = event.target.closest("[data-master-project-select]");
  if (masterProjectSelect) {
    updateMasterProjectControls(masterProjectSelect);
    return;
  }

  const progressStageSelect = event.target.closest("[data-progress-stage-select]");
  if (progressStageSelect) {
    updateProgressSubtrackControls(progressStageSelect);
    return;
  }

  const roleControl = event.target.closest("[data-user-role]");
  if (roleControl) {
    updateUserField(roleControl.dataset.userRole, "role", roleControl.value);
    return;
  }

  const statusControl = event.target.closest("[data-user-status]");
  if (statusControl) {
    updateUserField(statusControl.dataset.userStatus, "status", statusControl.value);
  }
}

function handleSubmit(event) {
  const form = event.target;

  if (form.id === "authForm") {
    event.preventDefault();
    authenticate(form);
    return;
  }

  if (form.id === "firebaseSetupForm") {
    event.preventDefault();
    saveFirebaseConfig(form);
    return;
  }

  if (form.id === "vehicleProjectInfoForm") {
    event.preventDefault();
    saveVehicleProjectInfo(form);
    return;
  }

  if (form.id === "masterProjectForm") {
    event.preventDefault();
    saveMasterProject(form);
    return;
  }

  if (form.id === "fileForm") {
    event.preventDefault();
    saveFileItem(form);
    return;
  }

  if (form.id === "projectForm") {
    event.preventDefault();
    saveProjectItem(form);
    return;
  }

  if (form.id === "progressForm") {
    event.preventDefault();
    saveProgressItem(form);
  }
}

async function authenticate(form) {
  if (!state.firebaseReady) {
    setSync("Firebase setup needed", "local");
    return;
  }

  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim();

  try {
    setSync("Authenticating", "saving");
    if (state.authMode === "signup") {
      const credential = await state.sdk.createUserWithEmailAndPassword(state.auth, email, password);
      if (displayName) {
        await state.sdk.updateProfile(credential.user, { displayName });
      }
    } else {
      await state.sdk.signInWithEmailAndPassword(state.auth, email, password);
    }
  } catch (error) {
    console.error(error);
    setSync(error.message.replace("Firebase: ", ""), "error");
  }
}

async function signOut() {
  if (state.mode === "firebase" && state.auth) {
    await state.sdk.signOut(state.auth);
    return;
  }

  startLocalMode("Local mode");
}

async function saveFirebaseConfig(form) {
  const rawConfig = String(new FormData(form).get("firebaseConfig") || "").trim();
  const parsedConfig = safeJsonParse(rawConfig, null);

  if (!parsedConfig || !isFirebaseConfigured(parsedConfig)) {
    setSync("Invalid Firebase config", "error");
    return;
  }

  localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(parsedConfig, null, 2));
  window.HAFIZE_FIREBASE_CONFIG = parsedConfig;
  setSync("Firebase config saved", "online");
  await startFirebase(parsedConfig);
}

async function saveMasterProject(form) {
  const formData = new FormData(form);
  const project = {
    id: String(formData.get("id") || ""),
    projectName: cleanInput(formData.get("projectName")),
    projectCode: cleanInput(formData.get("projectCode")),
    status: normalizeProjectStatus(formData.get("status")),
    pelaksanaan: normalizePelaksanaan(formData.get("pelaksanaan"))
  };

  if (!project.projectName || !project.projectCode) {
    state.lastProjectSave = {
      tone: "error",
      message: "Type both Project Name and Project Code before saving."
    };
    setSync("Project name and code required", "error");
    renderShell();
    return;
  }

  const existing = project.id ? state.masterProjects.find((entry) => entry.id === project.id) : null;
  const nextProject = cleanObject({
    ...existing,
    ...project,
    title: project.projectName,
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
    updatedBy: state.profile?.displayName || state.user?.email || "Team member",
    updatedByUid: state.user?.uid || "local"
  });

  if (state.mode === "firebase" && state.db) {
    if (!isAdmin()) {
      setSync("Admin profile needed", "error");
      return;
    }

    try {
      state.lastProjectSave = {
        tone: "saving",
        message: `Saving ${project.projectCode} to Firebase...`
      };
      setSync("Saving project", "saving");
      const payload = cleanObject({
        ...nextProject,
        createdAt: existing?.createdAt || state.sdk.serverTimestamp(),
        updatedAt: state.sdk.serverTimestamp()
      });
      delete payload.id;

      const projectDocId = project.id || projectDocumentId(project);
      const projectRef = state.sdk.doc(state.db, "masterProjects", projectDocId);
      await state.sdk.setDoc(projectRef, payload, { merge: true });
      const savedSnapshot = state.sdk.getDocFromServer
        ? await state.sdk.getDocFromServer(projectRef)
        : await state.sdk.getDoc(projectRef);

      if (!savedSnapshot.exists()) {
        throw new Error(`Firebase did not return saved project ${projectDocId}.`);
      }

      nextProject.id = projectDocId;
      const savedProject = normalizeMasterProject({
        id: savedSnapshot.id,
        ...normalizeFirebaseData(savedSnapshot.data())
      });

      state.masterProjects = mergeById(
        state.masterProjects,
        [
          {
            ...savedProject,
            ...nextProject,
            id: project.id || nextProject.id,
            createdAt: existing?.createdAt || nowIso(),
            updatedAt: nowIso()
          }
        ]
      );
      state.lastProjectSave = {
        tone: "success",
        message: `Saved ${project.projectCode}. If needed, check Firestore Data > masterProjects > ${projectDocId}.`
      };
      setSync("Project saved", "online");
      form.reset();
      form.querySelector("[name='id']").value = "";
      renderShell();
    } catch (error) {
      console.error(error);
      state.lastProjectSave = {
        tone: "error",
        message: friendlyFirebaseError(error)
      };
      setSync(friendlyFirebaseError(error), "error");
      renderShell();
    }
    return;
  }

  if (project.id) {
    state.masterProjects = state.masterProjects.map((entry) => (entry.id === project.id ? nextProject : entry));
  } else {
    state.masterProjects = [{ ...nextProject, id: crypto.randomUUID() }, ...state.masterProjects];
  }

  persistLocal();
  state.lastProjectSave = {
    tone: "success",
    message: `Saved ${project.projectCode} locally.`
  };
  setSync("Project saved locally", "local");
  form.reset();
  form.querySelector("[name='id']").value = "";
  renderShell();
}

async function saveVehicleProjectInfo(form) {
  if (!isAdmin()) {
    state.lastVehicleInfoSave = {
      tone: "error",
      message: "Only admin can update Maklumat Kenderaan Projek."
    };
    setSync("Admin only", "error");
    renderShell();
    return;
  }

  const formData = new FormData(form);
  const nextInfo = normalizeVehicleProjectInfo({
    id: VEHICLE_INFO_DOC_ID,
    type: VEHICLE_INFO_TYPE,
    projectName: formData.get("projectName"),
    contractNo: formData.get("contractNo"),
    contractor: formData.get("contractor"),
    driverNamePhone: formData.get("driverNamePhone"),
    vehicleRegistration: formData.get("vehicleRegistration"),
    vehicleType: formData.get("vehicleType"),
    responsibleOfficer: formData.get("responsibleOfficer"),
    officeName: formData.get("officeName"),
    reviewYear: formData.get("reviewYear"),
    updatedAt: nowIso(),
    updatedBy: state.profile?.displayName || state.user?.email || "Team member",
    updatedByUid: state.user?.uid || "local"
  });

  try {
    state.lastVehicleInfoSave = {
      tone: "saving",
      message: "Saving Maklumat Kenderaan Projek..."
    };
    setSync("Saving vehicle info", "saving");
    renderShell();

    if (state.mode === "firebase" && state.db) {
      const payload = cleanObject({
        ...nextInfo,
        updatedAt: state.sdk.serverTimestamp()
      });
      delete payload.id;
      await state.sdk.setDoc(state.sdk.doc(state.db, "trackerItems", VEHICLE_INFO_DOC_ID), payload, { merge: true });
    }

    state.vehicleInfo = nextInfo;
    persistLocal();
    state.lastVehicleInfoSave = {
      tone: "success",
      message: "Maklumat Kenderaan Projek saved."
    };
    setSync(state.mode === "firebase" ? "Vehicle info synced" : "Vehicle info saved locally", state.mode === "firebase" ? "online" : "local");
    renderShell();
  } catch (error) {
    console.error(error);
    state.lastVehicleInfoSave = {
      tone: "error",
      message: friendlyFirebaseError(error)
    };
    setSync(friendlyFirebaseError(error), "error");
    renderShell();
  }
}

function renderVehicleInfoSaveNotice() {
  if (!state.lastVehicleInfoSave) {
    return "";
  }

  return `
    <div class="inline-notice ${escapeAttribute(state.lastVehicleInfoSave.tone)}" role="status">
      <i data-lucide="${state.lastVehicleInfoSave.tone === "error" ? "circle-alert" : "info"}"></i>
      <span>${escapeHtml(state.lastVehicleInfoSave.message)}</span>
    </div>
  `;
}

async function downloadProjectExcel() {
  if (!ensureExcelDownloadLibrary()) {
    return;
  }

  try {
    setSync("Preparing Excel", "saving");
    const workbook = new window.ExcelJS.Workbook();
    workbook.creator = "NADI Track";
    workbook.lastModifiedBy = state.profile?.displayName || state.user?.email || "NADI Track";
    workbook.created = new Date();
    workbook.modified = new Date();

    const logoBase64 = await fetchLogoBase64();
    buildCoverWorksheet(workbook, logoBase64);
    buildConfirmationWorksheet(workbook);
    buildProjectListWorksheet(workbook);

    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbookBuffer(buffer, projectExcelFileName());
    setSync("Excel downloaded", state.mode === "firebase" ? "online" : "local");
  } catch (error) {
    console.error(error);
    state.lastProjectSave = {
      tone: "error",
      message: friendlyFirebaseError(error)
    };
    setSync(friendlyFirebaseError(error), "error");
    renderShell();
  }
}

function chooseProjectExcelFile() {
  if (!isAdmin()) {
    state.lastProjectSave = {
      tone: "error",
      message: "Only admin can upload project Excel."
    };
    setSync("Admin only", "error");
    renderShell();
    return;
  }

  const input = document.querySelector("[data-project-excel-upload]");
  if (!input) {
    return;
  }

  input.value = "";
  input.click();
}

async function importProjectExcel(input) {
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  if (!isAdmin()) {
    state.lastProjectSave = {
      tone: "error",
      message: "Only admin can upload project Excel."
    };
    setSync("Admin only", "error");
    input.value = "";
    renderShell();
    return;
  }

  if (!ensureExcelLibrary()) {
    input.value = "";
    return;
  }

  try {
    setSync("Reading Excel", "saving");
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const worksheet = findProjectWorksheet(workbook);

    const rows = parseProjectExcelRows(worksheet);
    const importBatch = buildProjectImportBatch(rows);

    if (!importBatch.projects.length) {
      state.lastProjectSave = {
        tone: "info",
        message: projectImportSummary(importBatch, "No new projects imported.")
      };
      setSync("No new projects", state.mode === "firebase" ? "online" : "local");
      input.value = "";
      renderShell();
      return;
    }

    state.lastProjectSave = {
      tone: "saving",
      message: `Importing ${importBatch.projects.length} project${importBatch.projects.length === 1 ? "" : "s"} from Excel...`
    };
    renderShell();

    await saveImportedMasterProjects(importBatch.projects);
    state.lastProjectSave = {
      tone: "success",
      message: projectImportSummary(importBatch, `Imported ${importBatch.projects.length} project${importBatch.projects.length === 1 ? "" : "s"}.`)
    };
    setSync("Projects imported", state.mode === "firebase" ? "online" : "local");
    input.value = "";
    renderShell();
  } catch (error) {
    console.error(error);
    state.lastProjectSave = {
      tone: "error",
      message: friendlyFirebaseError(error)
    };
    setSync(friendlyFirebaseError(error), "error");
    input.value = "";
    renderShell();
  }
}

function ensureExcelLibrary() {
  if (window.XLSX) {
    return true;
  }

  state.lastProjectSave = {
    tone: "error",
    message: "Excel tool is still loading. Refresh the page and try again."
  };
  setSync("Excel unavailable", "error");
  renderShell();
  return false;
}

function ensureExcelDownloadLibrary() {
  if (window.ExcelJS) {
    return true;
  }

  state.lastProjectSave = {
    tone: "error",
    message: "Excel formatter is still loading. Refresh the page and try again."
  };
  setSync("Excel formatter unavailable", "error");
  renderShell();
  return false;
}

function findProjectWorksheet(workbook) {
  for (const sheetName of workbook.SheetNames || []) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      continue;
    }

    try {
      parseProjectExcelRows(worksheet);
      return worksheet;
    } catch {
      // Continue scanning; downloaded workbooks now include cover sheets before the project list.
    }
  }

  throw new Error("Excel must include a sheet with columns: Bil, Project Name, Project Code, Status, Pelaksanaan.");
}

async function fetchLogoBase64() {
  const response = await fetch(JKR_LOGO_PATH);
  if (!response.ok) {
    throw new Error("JKR logo could not be loaded for Excel download.");
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

function buildCoverWorksheet(workbook, logoBase64) {
  const info = normalizeVehicleProjectInfo(state.vehicleInfo);
  const sheet = workbook.addWorksheet(EXCEL_COVER_SHEET_NAME, {
    pageSetup: {
      paperSize: 1,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      verticalCentered: true,
      margins: { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 },
      printArea: "A1:N34"
    },
    views: [{ showGridLines: false }]
  });

  for (let col = 1; col <= 14; col += 1) {
    sheet.getColumn(col).width = 9.6;
  }
  for (let row = 1; row <= 34; row += 1) {
    sheet.getRow(row).height = row < 12 ? 24 : 27;
  }

  applyOuterBorder(sheet, 2, 2, 33, 13, "double");

  const logoId = workbook.addImage({ base64: logoBase64, extension: "png" });
  sheet.addImage(logoId, {
    tl: { col: 5.1, row: 3.0 },
    ext: { width: 300, height: 225 }
  });

  mergeAndStyle(sheet, "B14:M14", "JABATAN KERJA RAYA MALAYSIA", {
    font: { name: "Arial", size: 18, bold: true },
    alignment: centerMiddle()
  });
  mergeAndStyle(sheet, "B17:M17", "BUKU LOG KENDERAAN", {
    font: { name: "Arial", size: 24, bold: true },
    alignment: centerMiddle()
  });

  addCoverInfoRow(sheet, 20, "NAMA PROJEK:", coverValue(info.projectName, "NAMA PROJEK"));
  addCoverInfoRow(sheet, 25, "NO. KONTRAK:", coverValue(info.contractNo, "NO KONTRAK"));
  addCoverInfoRow(sheet, 27, "KONTRAKTOR:", coverValue(info.contractor, "NAMA KONTRAKTOR"));
  addCoverInfoRow(sheet, 29, "NAMA PEMANDU DAN NO. (H/P):", coverValue(info.driverNamePhone, "NAMA PEMANDU DAN NO. HP"));
  addCoverInfoRow(sheet, 31, "NO.PENDAFTARAN:", coverValue(info.vehicleRegistration, "NO KENDERAAN"));
}

function addCoverInfoRow(sheet, row, label, value) {
  sheet.mergeCells(`C${row}:E${row}`);
  sheet.mergeCells(`F${row}:L${row}`);
  const labelCell = sheet.getCell(`C${row}`);
  const valueCell = sheet.getCell(`F${row}`);
  labelCell.value = label;
  valueCell.value = value;
  [labelCell, valueCell].forEach((cell) => {
    cell.font = { name: "Arial", size: 14, bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });
}

function buildConfirmationWorksheet(workbook) {
  const info = normalizeVehicleProjectInfo(state.vehicleInfo);
  const year = normalizeReviewYear(info.reviewYear);
  const sheet = workbook.addWorksheet(EXCEL_CONFIRMATION_SHEET_NAME, {
    pageSetup: {
      paperSize: 8,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      verticalCentered: false,
      margins: { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 },
      printArea: "A1:E22"
    },
    views: [{ showGridLines: false }]
  });

  sheet.columns = [
    { key: "bil", width: 8 },
    { key: "bulan", width: 28 },
    { key: "disemak", width: 32 },
    { key: "tandatangan", width: 42 },
    { key: "ulasan", width: 42 }
  ];

  [1, 2, 3, 4].forEach((row) => {
    sheet.getRow(row).height = 18;
  });
  sheet.getRow(5).height = 22;
  sheet.getRow(6).height = 28;
  sheet.getRow(8).height = 30;
  sheet.getRow(10).height = 42;
  for (let row = 11; row <= 22; row += 1) {
    sheet.getRow(row).height = 38;
  }

  mergeAndStyle(sheet, "E2:E2", "Lampiran 8", {
    font: { name: "Arial", size: 11, bold: true },
    alignment: { horizontal: "right", vertical: "middle" }
  });
  mergeAndStyle(sheet, "E4:E4", "(kepada SA KPKR Bil 3/2017)", {
    font: { name: "Arial", size: 11 },
    alignment: { horizontal: "right", vertical: "middle" }
  });
  mergeAndStyle(sheet, "A5:E5", "PENGESAHAN DAN SEMAKAN BULANAN", {
    font: { name: "Arial", size: 14, bold: true },
    alignment: centerMiddle(),
    fill: solidFill("FFD9EFD2"),
    border: boxBorder("medium")
  });

  mergeAndStyle(sheet, "A6:B6", `JENIS KENDERAAN: ${fieldValue(info.vehicleType, "XXX")}`, confirmationInfoStyle());
  mergeAndStyle(sheet, "C6:E6", `NO.PENDAFTARAN KENDERAAN: ${fieldValue(info.vehicleRegistration, "XXX")}`, confirmationInfoStyle());
  mergeAndStyle(sheet, "A8:B8", `PEGAWAI YANG BERTANGGUNGJAWAB : ${fieldValue(info.responsibleOfficer, "\"NAMA PENUH PENYELIA\"")}`, confirmationInfoStyle());
  mergeAndStyle(sheet, "C8:E8", `NAMA PEJABAT: ${fieldValue(info.officeName, "CAWANGAN KEJURUTERAAN AWAM DAN STRUKTUR")}`, confirmationInfoStyle());

  const headers = ["Bil.", "Bulan / Tahun", "Disemak Oleh", "Tandatangan & Cop", "Ulasan / Catatan"];
  headers.forEach((header, index) => {
    const cell = sheet.getCell(10, index + 1);
    cell.value = header;
    cell.font = { name: "Arial", size: 11, bold: true };
    cell.alignment = centerMiddle();
    cell.fill = solidFill("FFD9D9D9");
    cell.border = boxBorder("medium");
  });

  CONFIRMATION_MONTHS.forEach((month, index) => {
    const rowNumber = 11 + index;
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = `${month} / ${year}`;
    for (let col = 1; col <= 5; col += 1) {
      const cell = row.getCell(col);
      cell.font = { name: "Arial", size: col === 2 ? 12 : 11, bold: col === 2 };
      cell.alignment = centerMiddle();
      cell.border = boxBorder("thin");
    }
  });

  applyOuterBorder(sheet, 10, 1, 22, 5, "medium");
}

function buildProjectListWorksheet(workbook) {
  const sheet = workbook.addWorksheet(PROJECT_EXCEL_SHEET_NAME, {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 }
    },
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }]
  });

  sheet.columns = [
    { key: "bil", width: 8 },
    { key: "projectName", width: 68 },
    { key: "projectCode", width: 20 },
    { key: "status", width: 16 },
    { key: "pelaksanaan", width: 32 }
  ];

  const headerRow = sheet.addRow(PROJECT_EXCEL_HEADERS);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = solidFill("FF1E6F68");
    cell.alignment = centerMiddle();
    cell.border = boxBorder("thin");
  });

  sortedMasterProjects().forEach((project, index) => {
    const row = sheet.addRow([
      index + 1,
      project.projectName || "",
      project.projectCode || "",
      normalizeProjectStatus(project.status),
      normalizePelaksanaan(project.pelaksanaan)
    ]);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 11 };
      cell.alignment = { horizontal: colNumber === 2 ? "left" : "center", vertical: "middle", wrapText: true };
      cell.border = boxBorder("thin");
    });
  });
}

function downloadWorkbookBuffer(buffer, fileName) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function mergeAndStyle(sheet, range, value, style = {}) {
  const [start, end] = range.split(":");
  if (end && end !== start) {
    sheet.mergeCells(range);
  }
  const cell = sheet.getCell(start);
  cell.value = value;
  Object.assign(cell, style);
  return cell;
}

function centerMiddle() {
  return { horizontal: "center", vertical: "middle", wrapText: true };
}

function solidFill(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function boxBorder(style = "thin") {
  return {
    top: { style },
    left: { style },
    bottom: { style },
    right: { style }
  };
}

function applyOuterBorder(sheet, topRow, leftCol, bottomRow, rightCol, style = "thin") {
  for (let row = topRow; row <= bottomRow; row += 1) {
    for (let col = leftCol; col <= rightCol; col += 1) {
      const cell = sheet.getCell(row, col);
      cell.border = {
        ...cell.border,
        ...(row === topRow ? { top: { style } } : {}),
        ...(row === bottomRow ? { bottom: { style } } : {}),
        ...(col === leftCol ? { left: { style } } : {}),
        ...(col === rightCol ? { right: { style } } : {})
      };
    }
  }
}

function coverValue(value, placeholder) {
  const cleanValue = cleanInput(value);
  return cleanValue || `"${placeholder}"`;
}

function fieldValue(value, placeholder) {
  return cleanInput(value) || placeholder;
}

function confirmationInfoStyle() {
  return {
    font: { name: "Arial", size: 11, bold: true },
    alignment: { horizontal: "left", vertical: "middle", wrapText: true }
  };
}

function parseProjectExcelRows(worksheet) {
  const rawRows = window.XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false
  });

  if (!rawRows.length) {
    return [];
  }

  const requiredHeaders = PROJECT_EXCEL_HEADERS.map(normalizeExcelHeader);
  const headerIndex = rawRows.findIndex((row) => {
    const headerMap = mapExcelHeaders(row);
    return requiredHeaders.every((header) => headerMap.has(header));
  });

  if (headerIndex === -1) {
    throw new Error("Excel must use columns: Bil, Project Name, Project Code, Status, Pelaksanaan.");
  }

  const headerMap = mapExcelHeaders(rawRows[headerIndex]);
  return rawRows
    .slice(headerIndex + 1)
    .map((row) => ({
      bil: row[headerMap.get("bil")] ?? "",
      projectName: row[headerMap.get("projectname")] ?? "",
      projectCode: row[headerMap.get("projectcode")] ?? "",
      status: row[headerMap.get("status")] ?? "",
      pelaksanaan: row[headerMap.get("pelaksanaan")] ?? ""
    }))
    .filter((row) =>
      [row.projectName, row.projectCode, row.status, row.pelaksanaan].some((value) => cleanInput(value))
    );
}

function mapExcelHeaders(row = []) {
  const headerMap = new Map();
  row.forEach((cell, index) => {
    const key = normalizeExcelHeader(cell);
    if (key) {
      headerMap.set(key, index);
    }
  });
  return headerMap;
}

function normalizeExcelHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildProjectImportBatch(rows) {
  const existingProjectCodes = new Set(state.masterProjects.map((project) => projectCodeKey(project.projectCode)));
  const existingProjectIds = new Set(state.masterProjects.map((project) => String(project.id || "")));
  const importedProjectCodes = new Set();
  const importedProjectIds = new Set();
  const result = {
    projects: [],
    duplicateCount: 0,
    skippedCount: 0,
    rowCount: rows.length
  };

  rows.forEach((row) => {
    const bil = cleanInput(row.bil);
    const projectName = cleanInput(row.projectName);
    const projectCode = cleanInput(row.projectCode);
    const status = resolveImportedProjectStatus(row.status);
    const pelaksanaan = resolveImportedPelaksanaan(row.pelaksanaan);

    if (!bil || !projectName || !projectCode || !status || !pelaksanaan) {
      result.skippedCount += 1;
      return;
    }

    const codeKey = projectCodeKey(projectCode);
    const projectId = projectDocumentId({ projectName, projectCode });
    if (
      existingProjectCodes.has(codeKey) ||
      importedProjectCodes.has(codeKey) ||
      existingProjectIds.has(projectId) ||
      importedProjectIds.has(projectId)
    ) {
      result.duplicateCount += 1;
      return;
    }

    importedProjectCodes.add(codeKey);
    importedProjectIds.add(projectId);
    result.projects.push({
      projectName,
      projectCode,
      status,
      pelaksanaan
    });
  });

  return result;
}

async function saveImportedMasterProjects(projects) {
  const updatedBy = state.profile?.displayName || state.user?.email || "Team member";
  const updatedByUid = state.user?.uid || "local";
  const savedProjects = projects.map((project) =>
    cleanObject({
      ...project,
      id: projectDocumentId(project),
      title: project.projectName,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      updatedBy,
      updatedByUid
    })
  );

  if (state.mode === "firebase" && state.db) {
    if (!isAdmin()) {
      throw new Error("Only admin can upload project Excel.");
    }

    for (let index = 0; index < savedProjects.length; index += 450) {
      const batch = state.sdk.writeBatch(state.db);
      savedProjects.slice(index, index + 450).forEach((project) => {
        const payload = cleanObject({
          ...project,
          createdAt: state.sdk.serverTimestamp(),
          updatedAt: state.sdk.serverTimestamp()
        });
        delete payload.id;
        batch.set(state.sdk.doc(state.db, "masterProjects", project.id), payload, { merge: true });
      });
      await batch.commit();
    }

    state.masterProjects = mergeById(state.masterProjects, savedProjects);
    return savedProjects;
  }

  state.masterProjects = mergeById(state.masterProjects, savedProjects);
  persistLocal();
  return savedProjects;
}

function projectImportSummary(importBatch, lead) {
  const notes = [];
  if (importBatch.duplicateCount) {
    notes.push(`${importBatch.duplicateCount} duplicate skipped`);
  }
  if (importBatch.skippedCount) {
    notes.push(`${importBatch.skippedCount} incomplete or invalid row skipped`);
  }
  return `${lead}${notes.length ? ` ${notes.join(", ")}.` : ""}`;
}

function projectExcelFileName() {
  return `NADI-Track-Projects-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function projectCodeKey(value) {
  return cleanInput(value).toUpperCase();
}

function resolveImportedProjectStatus(value) {
  const cleanValue = cleanInput(value);
  if (!cleanValue) {
    return "";
  }

  const lowerValue = cleanValue.toLowerCase();
  if (["active", "aktif", "running"].includes(lowerValue)) {
    return "Aktif";
  }
  if (["serah", "closed"].includes(lowerValue)) {
    return "Serah";
  }

  return PROJECT_MASTER_STATUSES.find((status) => status.toLowerCase() === lowerValue) || "";
}

function resolveImportedPelaksanaan(value) {
  const cleanValue = cleanInput(value);
  if (!cleanValue) {
    return "";
  }

  return PELAKSANAAN_OPTIONS.find((option) => option.toLowerCase() === cleanValue.toLowerCase()) || "";
}

async function saveFileItem(form) {
  try {
    const formData = new FormData(form);
    const masterProject =
      getMasterProjectById(formData.get("projectId")) || resolveMasterProjectFromSearch(formData.get("projectSearch"));
    const jilid = normalizeJilid(formData.get("jilid"));
    const cabinet = cleanInput(formData.get("cabinet"));
    const row = cleanInput(formData.get("row"));
    const fileName = formatJilidName(masterProject, jilid);
    const item = {
      id: String(formData.get("id") || ""),
      type: "file",
      ...projectFields(masterProject),
      jilid,
      fileName,
      title: fileName,
      fileStatus: "Running",
      cabinet,
      row,
      location: formatHardcopyLocation(cabinet, row),
      notes: cleanInput(formData.get("notes"))
    };

    if (!masterProject) {
      setTrackerNotice("file", "error", "Select a project first.");
      setSync("Project required", "error");
      renderShell();
      return;
    }

    if (!cabinet || !row) {
      setTrackerNotice("file", "error", "Type both Kabinet and Para before saving.");
      setSync("Kabinet and para required", "error");
      renderShell();
      return;
    }

    setTrackerNotice("file", "saving", `Saving ${fileName}...`);
    setSync("Saving file", "saving");
    const savedItem = await saveItem(item);
    await recalculateFileStatusesForProject(masterProject);
    setTrackerNotice("file", "success", `Saved ${savedItem.fileName || savedItem.title}.`);
    form.reset();
    form.querySelector("[name='id']").value = "";
    updateMasterProjectSearchControls(form.querySelector("[data-master-project-search]"));
    renderShell();
  } catch (error) {
    console.error(error);
    setTrackerNotice("file", "error", friendlyFirebaseError(error));
    setSync(friendlyFirebaseError(error), "error");
    renderShell();
  }
}

async function saveProjectItem(form) {
  try {
    const formData = new FormData(form);
    const masterProject = getMasterProjectById(formData.get("projectId"));
    const customSubtrack = cleanInput(formData.get("customSubtrack"));
    const subtrack = customSubtrack || cleanInput(formData.get("subtrack"));
    const item = {
      id: String(formData.get("id") || ""),
      type: "project",
      ...projectFields(masterProject),
      subtrack,
      title: subtrack,
      status: cleanInput(formData.get("status")) || "Not Started",
      progress: Number(formData.get("progress") || 0),
      owner: cleanInput(formData.get("owner")),
      dueDate: cleanInput(formData.get("dueDate")),
      notes: cleanInput(formData.get("notes"))
    };

    if (!masterProject || !item.subtrack) {
      setTrackerNotice("project", "error", "Select a project and sub-tracking before saving.");
      setSync("Project tracking fields required", "error");
      renderShell();
      return;
    }

    setTrackerNotice("project", "saving", `Saving ${item.subtrack}...`);
    setSync("Saving project tracking", "saving");
    const savedItem = await saveItem(item);
    setTrackerNotice("project", "success", `Saved ${savedItem.subtrack || savedItem.title}.`);
    form.reset();
    form.querySelector("[name='id']").value = "";
    updateMasterProjectControls(form.querySelector("[data-master-project-select]"));
    renderShell();
  } catch (error) {
    console.error(error);
    setTrackerNotice("project", "error", friendlyFirebaseError(error));
    setSync(friendlyFirebaseError(error), "error");
    renderShell();
  }
}

async function saveProgressItem(form) {
  try {
    const formData = new FormData(form);
    const masterProject = getMasterProjectById(formData.get("projectId"));
    const customSubtrack = cleanInput(formData.get("customSubtrack"));
    const subtrack = customSubtrack || cleanInput(formData.get("subtrack"));
    const item = {
      id: String(formData.get("id") || ""),
      type: "progress",
      ...projectFields(masterProject),
      stage: cleanInput(formData.get("stage")),
      subtrack,
      title: subtrack,
      status: cleanInput(formData.get("status")) || "Not Started",
      progress: Number(formData.get("progress") || 0),
      owner: cleanInput(formData.get("owner")),
      dueDate: cleanInput(formData.get("dueDate")),
      notes: cleanInput(formData.get("notes"))
    };

    if (!masterProject || !item.stage || !item.subtrack) {
      setTrackerNotice("progress", "error", "Select a project, stage, and sub-tracking before saving.");
      setSync("Progress tracking fields required", "error");
      renderShell();
      return;
    }

    setTrackerNotice("progress", "saving", `Saving ${item.subtrack}...`);
    setSync("Saving progress", "saving");
    const savedItem = await saveItem(item);
    setTrackerNotice("progress", "success", `Saved ${savedItem.subtrack || savedItem.title}.`);
    form.reset();
    form.querySelector("[name='id']").value = "";
    updateMasterProjectControls(form.querySelector("[data-master-project-select]"));
    renderShell();
  } catch (error) {
    console.error(error);
    setTrackerNotice("progress", "error", friendlyFirebaseError(error));
    setSync(friendlyFirebaseError(error), "error");
    renderShell();
  }
}

async function saveItem(item) {
  const existing = item.id ? state.items.find((entry) => entry.id === item.id) : null;
  const nextItem = normalizeTrackerItem(cleanObject({
    ...existing,
    ...item,
    progress: clamp(Number(item.progress ?? existing?.progress ?? 0), 0, 100),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
    updatedBy: state.profile?.displayName || state.user?.email || "Team member",
    updatedByUid: state.user?.uid || "local"
  }));

  if (state.mode === "firebase" && state.db) {
    setSync("Saving", "saving");
    const payload = cleanObject({
      ...nextItem,
      updatedAt: state.sdk.serverTimestamp(),
      createdAt: existing?.createdAt || state.sdk.serverTimestamp()
    });
    delete payload.id;

    const itemRef = item.id
      ? state.sdk.doc(state.db, "trackerItems", item.id)
      : state.sdk.doc(state.sdk.collection(state.db, "trackerItems"));

    if (item.id) {
      await state.sdk.updateDoc(itemRef, payload);
    } else {
      await state.sdk.setDoc(itemRef, payload);
    }

    const savedSnapshot = state.sdk.getDocFromServer
      ? await state.sdk.getDocFromServer(itemRef)
      : await state.sdk.getDoc(itemRef);

    if (!savedSnapshot.exists()) {
      throw new Error(`Firebase did not return saved tracker row ${itemRef.id}.`);
    }

    const savedItem = normalizeTrackerItem({
      id: savedSnapshot.id,
      ...normalizeFirebaseData(savedSnapshot.data())
    });
    const mergedItem = normalizeTrackerItem({
      ...nextItem,
      ...savedItem,
      id: itemRef.id,
      createdAt: savedItem.createdAt || nextItem.createdAt,
      updatedAt: savedItem.updatedAt || nowIso()
    });
    state.items = mergeById(state.items, [mergedItem]);
    await touchMasterProject(mergedItem.projectId);
    setSync("Saved", "online");
    return mergedItem;
  }

  let savedItem;
  if (item.id) {
    savedItem = nextItem;
    state.items = state.items.map((entry) => (entry.id === item.id ? savedItem : entry));
  } else {
    savedItem = { ...nextItem, id: crypto.randomUUID() };
    state.items = [savedItem, ...state.items];
  }

  await touchMasterProject(savedItem.projectId);
  persistLocal();
  setSync("Saved locally", "local");
  return savedItem;
}

async function touchMasterProject(projectId) {
  const project = getMasterProjectById(projectId);
  if (!project) {
    return;
  }

  const touch = {
    updatedAt: nowIso(),
    updatedBy: state.profile?.displayName || state.user?.email || "Team member",
    updatedByUid: state.user?.uid || "local"
  };

  state.masterProjects = state.masterProjects.map((entry) =>
    entry.id === project.id
      ? {
          ...entry,
          ...touch
        }
      : entry
  );

  if (state.mode === "firebase" && state.db && isAdmin()) {
    try {
      await state.sdk.updateDoc(state.sdk.doc(state.db, "masterProjects", project.id), {
        updatedAt: state.sdk.serverTimestamp(),
        updatedBy: touch.updatedBy,
        updatedByUid: touch.updatedByUid
      });
    } catch (error) {
      console.warn("Could not update master project timestamp", error);
    }
  }
}

async function deleteMasterProject(id) {
  if (!isAdmin()) {
    setSync("Admin only", "error");
    return;
  }

  const project = state.masterProjects.find((entry) => entry.id === id);
  if (!project) {
    return;
  }

  const linkedRows = linkedItemsForProject(project).length;
  if (linkedRows) {
    setSync("Project has tracker rows", "error");
    return;
  }

  const confirmed = window.confirm(`Delete "${project.projectName}" from List of Projects?`);
  if (!confirmed) {
    return;
  }

  if (state.mode === "firebase" && state.db) {
    try {
      setSync("Deleting project", "saving");
      await state.sdk.deleteDoc(state.sdk.doc(state.db, "masterProjects", id));
      state.masterProjects = state.masterProjects.filter((entry) => entry.id !== id);
      setSync("Project deleted", "online");
      renderShell();
    } catch (error) {
      console.error(error);
      state.lastProjectSave = {
        tone: "error",
        message: friendlyFirebaseError(error)
      };
      setSync(friendlyFirebaseError(error), "error");
      renderShell();
    }
    return;
  }

  state.masterProjects = state.masterProjects.filter((entry) => entry.id !== id);
  persistLocal();
  setSync("Project deleted locally", "local");
  renderShell();
}

async function deleteItem(id) {
  if (!isAdmin()) {
    setSync("Admin only", "error");
    return;
  }

  const item = state.items.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  const itemProject = getProjectForItem(item);
  const fileProject = item.type === "file" ? itemProject : null;

  const confirmed = window.confirm(`Delete "${item.title || item.fileName}"?`);
  if (!confirmed) {
    return;
  }

  if (state.mode === "firebase" && state.db) {
    try {
      setSync("Deleting", "saving");
      await state.sdk.deleteDoc(state.sdk.doc(state.db, "trackerItems", id));
      state.items = state.items.filter((entry) => entry.id !== id);
      await recalculateFileStatusesForProject(fileProject);
      await touchMasterProject(itemProject?.id);
      setSync("Deleted", "online");
      renderShell();
    } catch (error) {
      console.error(error);
      setTrackerNotice(item.type, "error", friendlyFirebaseError(error));
      setSync(friendlyFirebaseError(error), "error");
      renderShell();
    }
    return;
  }

  state.items = state.items.filter((entry) => entry.id !== id);
  await recalculateFileStatusesForProject(fileProject);
  await touchMasterProject(itemProject?.id);
  persistLocal();
  setSync("Deleted locally", "local");
  renderShell();
}

async function recalculateFileStatusesForProject(project) {
  if (!project) {
    return;
  }

  if (state.mode === "firebase" && state.db) {
    const filesSnapshot = await state.sdk.getDocs(
      state.sdk.query(
        state.sdk.collection(state.db, "trackerItems"),
        state.sdk.where("type", "==", "file"),
        state.sdk.where("projectId", "==", project.id)
      )
    );
    const files = filesSnapshot.docs.map((docSnapshot) =>
      normalizeTrackerItem({
        id: docSnapshot.id,
        ...normalizeFirebaseData(docSnapshot.data())
      })
    );
    if (!files.length) {
      return;
    }

    const maxJilid = Math.max(...files.map((file) => normalizeJilid(file.jilid)));
    const recalculatedFiles = files.map((file) => {
      const nextStatus = normalizeJilid(file.jilid) === maxJilid ? "Running" : "Closed";
      const statusChanged = normalizeFileStatus(file.fileStatus) !== nextStatus;
      return {
        ...file,
        fileStatus: nextStatus,
        updatedAt: statusChanged ? nowIso() : file.updatedAt,
        updatedBy: statusChanged ? state.profile?.displayName || state.user?.email || "Team member" : file.updatedBy,
        updatedByUid: statusChanged ? state.user?.uid || "local" : file.updatedByUid
      };
    });
    const batch = state.sdk.writeBatch(state.db);
    let hasUpdates = false;

    recalculatedFiles.forEach((file, index) => {
      if (normalizeFileStatus(files[index].fileStatus) !== file.fileStatus) {
        hasUpdates = true;
        batch.update(state.sdk.doc(state.db, "trackerItems", file.id), {
          fileStatus: file.fileStatus,
          updatedAt: state.sdk.serverTimestamp(),
          updatedBy: state.profile?.displayName || state.user?.email || "Team member",
          updatedByUid: state.user?.uid || "local"
        });
      }
    });

    if (hasUpdates) {
      await batch.commit();
    }
    state.items = mergeById(state.items, recalculatedFiles);
    return;
  }

  const files = linkedItemsForProject(project).filter((item) => item.type === "file");
  if (!files.length) {
    return;
  }

  const maxJilid = Math.max(...files.map((file) => normalizeJilid(file.jilid)));
  state.items = state.items.map((item) => {
    if (item.type !== "file" || item.projectId !== project.id) {
      return item;
    }

    const nextStatus = normalizeJilid(item.jilid) === maxJilid ? "Running" : "Closed";
    if (normalizeFileStatus(item.fileStatus) === nextStatus) {
      return item;
    }

    return {
      ...item,
      fileStatus: nextStatus,
      updatedAt: nowIso(),
      updatedBy: state.profile?.displayName || state.user?.email || "Team member",
      updatedByUid: state.user?.uid || "local"
    };
  });

  persistLocal();
}

async function startSeries(seriesType) {
  try {
    const projectSelect = document.querySelector(`#${seriesType}SeriesProject`);
    const masterProject = getMasterProjectById(projectSelect?.value);

    if (!masterProject) {
      setTrackerNotice(seriesType, "error", "Select a master project before starting a series.");
      setSync("Select a master project", "error");
      renderShell();
      return;
    }

    const category = masterProject.pelaksanaan;
    const stageSelect = document.querySelector("#progressSeriesStage");
    const stage = seriesType === "progress" ? cleanInput(stageSelect?.value) : "";
    const subtracks =
      seriesType === "project"
        ? PROJECT_SERIES[category] || []
        : PROGRESS_SERIES[category]?.[stage] || [];

    if (!subtracks.length) {
      setTrackerNotice(seriesType, "error", "No series template is available for this project.");
      setSync("No series for this project", "error");
      renderShell();
      return;
    }

    const now = nowIso();
    const entries = subtracks.map((subtrack) =>
      cleanObject({
        type: seriesType,
        ...projectFields(masterProject),
        category,
        stage: seriesType === "progress" ? stage : "",
        subtrack,
        title: subtrack,
        status: "Not Started",
        progress: 0,
        owner: state.profile?.displayName || "",
        notes: "",
        createdAt: now,
        updatedAt: now,
        updatedBy: state.profile?.displayName || state.user?.email || "Team member",
        updatedByUid: state.user?.uid || "local"
      })
    );

    setTrackerNotice(seriesType, "saving", `Creating ${entries.length} rows...`);

    if (state.mode === "firebase" && state.db) {
      setSync("Creating series", "saving");
      const batch = state.sdk.writeBatch(state.db);
      const refs = entries.map(() => state.sdk.doc(state.sdk.collection(state.db, "trackerItems")));
      entries.forEach((entry, index) => {
        batch.set(refs[index], {
          ...entry,
          createdAt: state.sdk.serverTimestamp(),
          updatedAt: state.sdk.serverTimestamp()
        });
      });
      await batch.commit();
      state.items = mergeById(
        state.items,
        entries.map((entry, index) =>
          normalizeTrackerItem({
            ...entry,
            id: refs[index].id
          })
        )
      );
      await touchMasterProject(masterProject.id);
      setTrackerNotice(seriesType, "success", `Created ${entries.length} rows for ${masterProject.projectCode}.`);
      setSync("Series saved", "online");
      renderShell();
      return;
    }

    state.items = mergeById(
      state.items,
      entries.map((entry) => ({
        ...entry,
        id: crypto.randomUUID()
      }))
    );
    await touchMasterProject(masterProject.id);
    persistLocal();
    setTrackerNotice(seriesType, "success", `Created ${entries.length} rows for ${masterProject.projectCode}.`);
    setSync("Series saved locally", "local");
    renderShell();
  } catch (error) {
    console.error(error);
    setTrackerNotice(seriesType, "error", friendlyFirebaseError(error));
    setSync(friendlyFirebaseError(error), "error");
    renderShell();
  }
}

async function updateUserField(userId, field, value) {
  if (!isAdmin()) {
    setSync("Admin only", "error");
    return;
  }

  if (state.mode === "firebase" && state.db) {
    setSync("Updating team", "saving");
    await state.sdk.updateDoc(state.sdk.doc(state.db, "users", userId), {
      [field]: value,
      updatedAt: state.sdk.serverTimestamp()
    });
    return;
  }

  state.users = state.users.map((user) => (user.id === userId ? { ...user, [field]: value } : user));
  persistLocal();
  setSync("Team saved locally", "local");
  renderShell();
}

function loadMasterProjectIntoForm(id) {
  const project = state.masterProjects.find((entry) => entry.id === id);
  if (!project) {
    return;
  }

  if (state.activeView !== "projectList") {
    state.activeView = "projectList";
    window.location.hash = "projectList";
  }

  requestAnimationFrame(() => {
    const form = document.querySelector("#masterProjectForm");
    if (!form) {
      return;
    }

    Object.entries(project).forEach(([key, value]) => {
      const field = form.querySelector(`[name="${key}"]`);
      if (field) {
        field.value = value ?? "";
      }
    });

    form.querySelector("[name='id']").value = project.id;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function loadItemIntoForm(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  const formId = item.type === "file" ? "fileForm" : item.type === "project" ? "projectForm" : "progressForm";
  const targetView = viewForItemType(item.type);
  if (state.activeView !== targetView) {
    state.activeView = targetView;
    window.location.hash = state.activeView;
  }

  requestAnimationFrame(() => {
    const form = document.querySelector(`#${formId}`);
    if (!form) {
      return;
    }

    Object.entries(item).forEach(([key, value]) => {
      const field = form.querySelector(`[name="${key}"]`);
      if (field) {
        field.value = value ?? "";
      }
    });

    form.querySelector("[name='id']").value = item.id;
    const projectSelect = form.querySelector("[data-master-project-select]");
    if (projectSelect) {
      projectSelect.value = item.projectId || "";
      updateMasterProjectControls(projectSelect);
    }
    const projectSearch = form.querySelector("[data-master-project-search]");
    if (projectSearch) {
      const project = getProjectForItem(item);
      const projectId = form.querySelector("[name='projectId']");
      projectSearch.value = projectLabelForItem(item, project);
      if (projectId) {
        projectId.value = project?.id || item.projectId || "";
      }
      updateMasterProjectSearchControls(projectSearch);
    }
    if (item.type === "file") {
      restoreFileFields(form, item);
    }
    restoreCustomSubtrack(form, item.subtrack);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function restoreCustomSubtrack(form, subtrack) {
  const subtrackSelect = form.querySelector("[name='subtrack']");
  const customSubtrack = form.querySelector("[name='customSubtrack']");
  if (!subtrackSelect || !customSubtrack || !subtrack) {
    return;
  }

  const hasOption = [...subtrackSelect.options].some((option) => option.value === subtrack);
  if (hasOption) {
    subtrackSelect.value = subtrack;
    customSubtrack.value = "";
    return;
  }

  customSubtrack.value = subtrack;
}

function updateMasterProjectControls(projectSelect) {
  if (!projectSelect) {
    return;
  }

  const container = projectSelect.closest("form") || projectSelect.closest("[data-series-type]");
  if (!container) {
    return;
  }

  const project = getMasterProjectById(projectSelect.value);
  const meta = container.querySelector("[data-linked-project-meta]");
  if (meta) {
    meta.innerHTML = renderLinkedProjectMeta(project);
  }

  if (container.id === "projectForm") {
    replaceSelectOptions(container.querySelector("[name='subtrack']"), projectSubtracksForProject(project));
  }

  if (container.id === "progressForm") {
    const stageSelect = container.querySelector("[name='stage']");
    replaceSelectOptions(stageSelect, progressStagesForProject(project));
    replaceSelectOptions(
      container.querySelector("[name='subtrack']"),
      progressSubtracksForProjectStage(project, stageSelect?.value)
    );
  }

  if (container.dataset.seriesType === "project") {
    const preview = container.querySelector("[data-series-preview]");
    if (preview) {
      preview.innerHTML = renderProjectSeriesPreview(project);
    }
  }

  if (container.dataset.seriesType === "progress") {
    const stageSelect = container.querySelector("[data-progress-stage-select]");
    replaceSelectOptions(stageSelect, progressStagesForProject(project));
    const preview = container.querySelector("[data-series-preview]");
    if (preview) {
      preview.innerHTML = renderProgressSeriesPreview(project, stageSelect?.value);
    }
  }
}

function updateProgressSubtrackControls(stageSelect) {
  const container = stageSelect.closest("form") || stageSelect.closest("[data-series-type='progress']");
  if (!container) {
    return;
  }

  const project = getMasterProjectById(container.querySelector("[data-master-project-select]")?.value);
  if (container.id === "progressForm") {
    replaceSelectOptions(
      container.querySelector("[name='subtrack']"),
      progressSubtracksForProjectStage(project, stageSelect.value)
    );
  }

  const preview = container.querySelector("[data-series-preview]");
  if (preview) {
    preview.innerHTML = renderProgressSeriesPreview(project, stageSelect.value);
  }
}

function replaceSelectOptions(select, options) {
  if (!select || !Array.isArray(options)) {
    return;
  }

  const previousValue = select.value;
  select.innerHTML = options.map((option) => `<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`).join("");
  select.value = options.includes(previousValue) ? previousValue : options[0] || "";
}

function updateMasterProjectSearchControls(projectSearch) {
  if (!projectSearch) {
    return;
  }

  const form = projectSearch.closest("form");
  if (!form) {
    return;
  }

  const project = resolveMasterProjectFromSearch(projectSearch.value, { allowPartial: true });
  const projectId = form.querySelector("[name='projectId']");
  if (projectId) {
    projectId.value = project?.id || "";
  }

  const meta = form.querySelector("[data-linked-project-meta]");
  if (meta) {
    meta.innerHTML = renderLinkedProjectMeta(project);
  }

  const results = form.querySelector("[data-project-search-results]");
  if (results) {
    results.innerHTML = renderProjectSearchResults(projectSearch.value, project?.id || "");
  }

  const jilid = form.querySelector("[name='jilid']");
  const editingExisting = Boolean(form.querySelector("[name='id']")?.value);
  if (jilid && project && !editingExisting) {
    jilid.value = String(nextJilidForProject(project));
  }
}

function updateFileLocationSearchControls(input) {
  state.fileLocationSearch = cleanInput(input.value);
  const panel = input.closest("[data-file-location-search-panel]");
  const results = panel?.querySelector("[data-file-location-search-results]");

  if (results) {
    results.innerHTML = renderFileLocationSearchResults(state.fileLocationSearch);
    refreshIcons();
  }
}

function updateMobileLookupSearch(input) {
  state.filter = cleanInput(input.value).toLowerCase();
  renderView();

  const nextInput = document.querySelector("[data-mobile-lookup-search]");
  if (nextInput) {
    nextInput.focus();
    const cursorPosition = nextInput.value.length;
    nextInput.setSelectionRange(cursorPosition, cursorPosition);
  }
}

function selectSearchProject(button) {
  const project = getMasterProjectById(button.dataset.id);
  const form = button.closest("form");
  if (!project || !form) {
    return;
  }

  const projectSearch = form.querySelector("[data-master-project-search]");
  const projectId = form.querySelector("[name='projectId']");
  if (projectSearch) {
    projectSearch.value = projectLabel(project);
  }
  if (projectId) {
    projectId.value = project.id;
  }

  updateMasterProjectSearchControls(projectSearch);
  const results = form.querySelector("[data-project-search-results]");
  if (results) {
    results.innerHTML = "";
  }
}

function restoreFileFields(form, item) {
  const jilid = form.querySelector("[name='jilid']");
  const cabinet = form.querySelector("[name='cabinet']");
  const row = form.querySelector("[name='row']");

  if (jilid) {
    jilid.value = String(normalizeJilid(item.jilid ?? inferJilidFromFileName(item.fileName, item.projectCode)));
  }

  if (cabinet) {
    cabinet.value = item.cabinet || parseHardcopyLocation(item.location).cabinet;
  }

  if (row) {
    row.value = item.row || parseHardcopyLocation(item.location).row;
  }
}

function clearLocalData() {
  if (state.mode !== "local") {
    return;
  }

  const confirmed = window.confirm("Clear local tracker data from this browser?");
  if (!confirmed) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  state.masterProjects = [];
  state.items = [];
  state.users = [state.profile];
  setSync("Local data cleared", "local");
  renderShell();
}

async function copyConfigTemplate() {
  const template = JSON.stringify(
    {
      apiKey: "paste-api-key",
      authDomain: "your-project-id.firebaseapp.com",
      projectId: "your-project-id",
      storageBucket: "your-project-id.appspot.com",
      messagingSenderId: "paste-sender-id",
      appId: "paste-app-id"
    },
    null,
    2
  );

  try {
    await navigator.clipboard.writeText(template);
    setSync("Config template copied", "online");
  } catch {
    setSync("Clipboard unavailable", "error");
  }
}

function renderShell() {
  const labels = {
    overview: ["Workspace", "Overview"],
    projectList: ["Master data", "List of Projects"],
    files: ["Tracker", "File Tracker"],
    projects: ["Tracker", "Project Tracker"],
    progress: ["Tracker", "Progress Tracker"],
    team: ["Admin", "Admin"]
  };

  els.viewEyebrow.textContent = labels[state.activeView]?.[0] || "Workspace";
  els.viewTitle.textContent = labels[state.activeView]?.[1] || "Overview";
  els.modePill.textContent = state.mode === "firebase" ? "Firebase" : "Local";
  els.modePill.className = `mode-pill ${state.mode === "firebase" ? "is-firebase" : "is-local"}`;

  els.navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === state.activeView);
  });

  document.body.dataset.mode = state.mode;
  renderSync();
  renderView();
  refreshIcons();
}

function renderView() {
  if (state.mode === "firebase" && state.firebaseReady && !state.user) {
    document.body.dataset.mobileSearch = "disabled";
    els.appView.innerHTML = renderAuthView();
    refreshIcons();
    return;
  }

  const views = {
    overview: renderOverview,
    projectList: renderProjectList,
    files: renderFileTracker,
    projects: renderProjectTracker,
    progress: renderProgressTracker,
    team: renderTeamView
  };

  const lookupFilter = activeLookupFilter();
  document.body.dataset.mobileSearch = hasMobileLookupView()
    ? lookupFilter
      ? "has-query"
      : "empty"
    : "disabled";
  els.appView.innerHTML = `
    ${renderMobileLookupPanel()}
    ${renderMobileSearchEmptyState()}
    ${(views[state.activeView] || renderOverview)()}
  `;
  refreshIcons();
}

function hasMobileLookupView() {
  return ["overview", "projectList", "files", "projects", "progress"].includes(state.activeView);
}

function renderMobileLookupPanel() {
  if (!hasMobileLookupView()) {
    return "";
  }

  const placeholderByView = {
    overview: "Search project name or code",
    projectList: "Search project name or code",
    files: "Search project for file location",
    projects: "Search project tracker",
    progress: "Search progress tracker"
  };

  return `
    <section class="panel mobile-lookup-panel">
      <label class="mobile-lookup-field">
        <span>Search</span>
        <input
          data-mobile-lookup-search
          value="${escapeAttribute(state.filter)}"
          placeholder="${escapeAttribute(placeholderByView[state.activeView] || "Search project")}"
          autocomplete="off"
        />
      </label>
      ${
        state.filter
          ? `<button class="secondary-button mobile-clear-button" type="button" data-action="clear-mobile-search">
              <i data-lucide="x"></i>
              <span>Clear search</span>
            </button>`
          : ""
      }
    </section>
  `;
}

function renderMobileSearchEmptyState() {
  if (!hasMobileLookupView()) {
    return "";
  }

  return `
    <section class="mobile-search-empty-state">
      <i data-lucide="search"></i>
      <h3>Search to show details</h3>
      <p>Type a project code or project name. Matching details and edit actions will appear here.</p>
    </section>
  `;
}

function renderAuthView() {
  const isSignup = state.authMode === "signup";
  return `
    <section class="auth-layout">
      <div class="auth-card">
        <div class="section-heading">
          <p class="eyebrow">Firebase account</p>
          <h2>${isSignup ? "Create account" : "Sign in"}</h2>
        </div>
        <form class="form-grid compact" id="authForm">
          ${
            isSignup
              ? `<label>Display name<input name="displayName" autocomplete="name" placeholder="Your name" required /></label>`
              : ""
          }
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required /></label>
          <button class="primary-button" type="submit">
            <i data-lucide="${isSignup ? "user-plus" : "log-in"}"></i>
            <span>${isSignup ? "Create account" : "Sign in"}</span>
          </button>
        </form>
        <button class="text-button" type="button" data-action="toggle-auth">
          ${isSignup ? "Use an existing account" : "Create a new account"}
        </button>
      </div>
    </section>
  `;
}

function renderOverview() {
  const visible = filteredItems();
  const visibleProjects = filteredMasterProjects();
  const files = visible.filter((item) => item.type === "file");
  const trackingItems = visible.filter((item) => item.type !== "file");
  const runningFiles = files.filter((item) => normalizeFileStatus(item.fileStatus) === "Running").length;
  const closedFiles = files.filter((item) => normalizeFileStatus(item.fileStatus) === "Closed").length;
  const blocked = trackingItems.filter((item) => item.status === "Blocked").length;
  const completed = trackingItems.filter((item) => item.status === "Completed").length;
  const activeProjects = visibleProjects.filter((project) => normalizeProjectStatus(project.status) === "Aktif").length;
  const recent = [...visible].sort(sortByUpdatedAt).slice(0, 6);

  return `
    <section class="metric-grid">
      ${renderMetric("Active projects", activeProjects, "briefcase-business", `${visibleProjects.length} in master list`)}
      ${renderMetric("Running files", runningFiles, "folder-open", `${closedFiles} closed`)}
      ${renderMetric("Completed tasks", completed, "check-circle-2", "Project and progress rows")}
      ${renderMetric("Blocked tasks", blocked, "octagon-alert", "Needs attention")}
    </section>

    <section class="split-layout mobile-searchable-section mobile-result-section">
      <div class="panel">
        <div class="section-heading">
          <p class="eyebrow">Live work</p>
          <h2>Recently updated</h2>
        </div>
        ${recent.length ? `<div class="activity-list">${recent.map(renderActivityRow).join("")}</div>` : renderEmptyState("No tracker rows yet", "Start with a file entry or create a tracking series.")}
      </div>

      <div class="panel">
        <div class="section-heading">
          <p class="eyebrow">Status</p>
          <h2>Progress by category</h2>
        </div>
        <div class="category-list">
          ${renderCategoryProgress("Konvensional Dalaman")}
          ${renderCategoryProgress("Konvensional Perunding")}
          ${renderCategoryProgress("Reka & Bina")}
        </div>
      </div>
    </section>
  `;
}

function renderProjectList() {
  const projects = filteredMasterProjects();

  return `
    <section class="panel mobile-searchable-section mobile-edit-section">
      ${renderMasterProjectForm()}
      ${renderProjectDebugNotice(projects)}
      ${renderProjectSaveNotice()}
    </section>

    <section class="table-section mobile-searchable-section mobile-result-section">
      ${renderMasterProjectTable(projects)}
    </section>
  `;
}

function renderFileTracker() {
  const files = filteredItems("file");
  const runningFiles = files.filter((item) => normalizeFileStatus(item.fileStatus) === "Running");
  const closedFiles = files.filter((item) => normalizeFileStatus(item.fileStatus) === "Closed");

  return `
    <section class="panel mobile-searchable-section mobile-edit-section">
      <div class="section-heading">
        <p class="eyebrow">Hardcopy location</p>
        <h2>File Tracker</h2>
      </div>
      ${renderFileForm()}
      ${renderTrackerDebugNotice("file", files)}
      ${renderTrackerSaveNotice("file")}
    </section>

    ${renderFileLocationSearch()}

    <section class="table-section mobile-searchable-section mobile-result-section">
      <div class="section-heading">
        <p class="eyebrow">${runningFiles.length} running</p>
        <h2>Running files</h2>
      </div>
      ${renderFileTable(runningFiles)}
    </section>

    <section class="table-section mobile-searchable-section mobile-result-section">
      <div class="section-heading">
        <p class="eyebrow">${closedFiles.length} closed</p>
        <h2>Closed files</h2>
      </div>
      ${renderFileTable(closedFiles)}
    </section>
  `;
}

function renderFileLocationSearch() {
  return `
    <section class="panel file-location-search-panel" data-file-location-search-panel>
      <div class="section-heading">
        <p class="eyebrow">Location search</p>
        <h2>Search file location</h2>
      </div>
      <div class="form-grid compact file-location-search-form">
        <label>
          Project code or project name
          <input
            data-file-location-search
            value="${escapeAttribute(state.fileLocationSearch)}"
            placeholder="Search logged project"
            autocomplete="off"
          />
        </label>
      </div>
      <div class="file-location-search-results" data-file-location-search-results>
        ${renderFileLocationSearchResults(state.fileLocationSearch)}
      </div>
    </section>
  `;
}

function renderFileLocationSearchResults(query) {
  const cleanQuery = cleanInput(query);
  if (!cleanQuery) {
    return renderEmptyState("Search logged file locations", "Type a project code or project name to show saved Kabinet and Para.");
  }

  const matches = searchFileLocationItems(cleanQuery);
  if (!matches.length) {
    return renderEmptyState("No logged file location found", "Check the project code or project name.");
  }

  return `
    <div class="location-result-summary">
      <strong>${matches.length}</strong>
      <span>logged file${matches.length === 1 ? "" : "s"} found</span>
    </div>
    <div class="table-wrap mobile-card-wrap">
      <table class="mobile-card-table">
        <thead>
          <tr>
            <th>Project Code</th>
            <th>Project</th>
            <th>Jilid</th>
            <th>Status</th>
            <th>Location</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          ${matches.map(renderFileLocationSearchRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFileLocationSearchRow(item) {
  const project = getProjectForItem(item);
  const status = normalizeFileStatus(item.fileStatus);
  const location = item.location
    ? isLikelyUrl(item.location)
      ? `<a href="${escapeAttribute(item.location)}" target="_blank" rel="noreferrer">${escapeHtml(item.location)}</a>`
      : escapeHtml(item.location)
    : `<span class="muted">Not set</span>`;

  return `
    <tr>
      <td data-label="Project Code"><strong>${escapeHtml(projectCodeForItem(item, project))}</strong></td>
      <td data-label="Project">${escapeHtml(projectNameForItem(item, project))}</td>
      <td data-label="Jilid">${escapeHtml(item.fileName || item.title)}</td>
      <td data-label="Status"><span class="status-pill table-pill ${statusClass(status)}">${escapeHtml(status)}</span></td>
      <td data-label="Location" class="location-cell">${location}</td>
      <td data-label="Updated">${formatDate(item.updatedAt)}</td>
    </tr>
  `;
}

function renderProjectTracker() {
  const items = filteredItems("project");
  return `
    ${renderProjectSeriesLauncher()}

    <section class="panel mobile-searchable-section mobile-edit-section">
      <div class="section-heading">
        <p class="eyebrow">Manual row</p>
        <h2>Add or update project tracking</h2>
      </div>
      ${renderProjectForm()}
      ${renderTrackerDebugNotice("project", items)}
      ${renderTrackerSaveNotice("project")}
    </section>

    ${renderTrackingBoard(items, "project")}
  `;
}

function renderProgressTracker() {
  const items = filteredItems("progress");
  return `
    ${renderProgressSeriesLauncher()}

    <section class="panel mobile-searchable-section mobile-edit-section">
      <div class="section-heading">
        <p class="eyebrow">Manual row</p>
        <h2>Add or update progress tracking</h2>
      </div>
      ${renderProgressForm()}
      ${renderTrackerDebugNotice("progress", items)}
      ${renderTrackerSaveNotice("progress")}
    </section>

    ${renderTrackingBoard(items, "progress")}
  `;
}

function renderTeamView() {
  const config = getFirebaseConfig();
  const configPreview = JSON.stringify(config, null, 2);

  return `
    <section class="split-layout">
      <div class="panel">
        <div class="section-heading">
          <p class="eyebrow">Vehicle log</p>
          <h2>Maklumat Kenderaan Projek</h2>
        </div>
        ${renderVehicleProjectInfoForm()}
        ${renderVehicleInfoSaveNotice()}
      </div>

      <div class="panel">
        <div class="section-heading">
          <p class="eyebrow">Access</p>
          <h2>Team accounts</h2>
        </div>
        <div class="team-list">
          ${state.users.map(renderTeamMember).join("")}
        </div>
      </div>

      <div class="panel">
        <div class="section-heading">
          <p class="eyebrow">${state.firebaseConfigured ? "Configured" : "Setup"}</p>
          <h2>Firebase connection</h2>
        </div>
        <form id="firebaseSetupForm" class="form-grid compact">
          <label>
            Firebase web config JSON
            <textarea name="firebaseConfig" rows="10" spellcheck="false">${escapeHtml(configPreview)}</textarea>
          </label>
          <div class="button-row">
            <button class="primary-button" type="submit">
              <i data-lucide="plug-zap"></i>
              <span>Use config</span>
            </button>
            <button class="secondary-button" type="button" data-action="copy-config-template">
              <i data-lucide="copy"></i>
              <span>Copy template</span>
            </button>
          </div>
        </form>
        ${
          state.mode === "local"
            ? `<button class="danger-button" type="button" data-action="clear-local-data"><i data-lucide="trash-2"></i><span>Clear local data</span></button>`
            : ""
        }
      </div>
    </section>
  `;
}

function renderVehicleProjectInfoForm() {
  const info = normalizeVehicleProjectInfo(state.vehicleInfo);
  const disabled = state.mode === "firebase" && !isAdmin();

  return `
    <form class="form-grid compact" id="vehicleProjectInfoForm" novalidate>
      <label>Nama Projek<input name="projectName" value="${escapeAttribute(info.projectName)}" placeholder="Nama projek untuk Muka Depan" ${disabled ? "disabled" : ""} /></label>
      <label>No. Kontrak<input name="contractNo" value="${escapeAttribute(info.contractNo)}" placeholder="No. kontrak" ${disabled ? "disabled" : ""} /></label>
      <label>Kontraktor<input name="contractor" value="${escapeAttribute(info.contractor)}" placeholder="Nama kontraktor" ${disabled ? "disabled" : ""} /></label>
      <label>Nama Pemandu dan No. (H/P)<input name="driverNamePhone" value="${escapeAttribute(info.driverNamePhone)}" placeholder="Nama pemandu dan no. telefon" ${disabled ? "disabled" : ""} /></label>
      <label>No. Pendaftaran Kenderaan<input name="vehicleRegistration" value="${escapeAttribute(info.vehicleRegistration)}" placeholder="No. kenderaan" ${disabled ? "disabled" : ""} /></label>
      <label>Jenis Kenderaan<input name="vehicleType" value="${escapeAttribute(info.vehicleType)}" placeholder="Jenis kenderaan" ${disabled ? "disabled" : ""} /></label>
      <label>Pegawai Bertanggungjawab<input name="responsibleOfficer" value="${escapeAttribute(info.responsibleOfficer)}" placeholder="Nama penuh penyelia" ${disabled ? "disabled" : ""} /></label>
      <label>Nama Pejabat<input name="officeName" value="${escapeAttribute(info.officeName)}" placeholder="Nama pejabat" ${disabled ? "disabled" : ""} /></label>
      <label>Tahun Pengesahan<input name="reviewYear" type="number" min="2000" max="2100" value="${escapeAttribute(info.reviewYear)}" ${disabled ? "disabled" : ""} /></label>
      <button class="primary-button" type="button" data-action="save-vehicle-info" ${disabled ? "disabled" : ""}>
        <i data-lucide="save"></i>
        <span>Simpan maklumat</span>
      </button>
    </form>
  `;
}

function renderMasterProjectForm() {
  const disabled = state.mode === "firebase" && !isAdmin();
  return `
    <form class="form-grid" id="masterProjectForm" novalidate>
      <input type="hidden" name="id" />
      <label>Project Name<input name="projectName" required placeholder="Project name" ${disabled ? "disabled" : ""} /></label>
      <label>Project Code<input name="projectCode" required placeholder="Project code" ${disabled ? "disabled" : ""} /></label>
      <label>Status${renderSelect("status", PROJECT_MASTER_STATUSES, "Aktif", disabled ? "disabled" : "")}</label>
      <label>Pelaksanaan${renderSelect("pelaksanaan", PELAKSANAAN_OPTIONS, "Konvensional Dalaman", disabled ? "disabled" : "")}</label>
      <button class="primary-button" type="button" data-action="save-master-project" ${disabled ? "disabled" : ""}>
        <i data-lucide="save"></i>
        <span>Save project</span>
      </button>
      <div class="button-row project-excel-actions full-span">
        <button class="secondary-button" type="button" data-action="download-project-excel">
          <i data-lucide="download"></i>
          <span>Muat Turun Excel</span>
        </button>
        <button class="secondary-button" type="button" data-action="choose-project-excel" ${disabled ? "disabled" : ""}>
          <i data-lucide="upload"></i>
          <span>Muat Naik Excel</span>
        </button>
        <input
          class="visually-hidden"
          type="file"
          accept=".xlsx,.xls"
          data-project-excel-upload
          ${disabled ? "disabled" : ""}
        />
      </div>
    </form>
  `;
}

function renderProjectDebugNotice(projects) {
  const email = state.user?.email || state.profile?.email || "not signed in";
  const role = isAdmin() ? "admin" : state.profile?.role || "no role";
  return `
    <div class="inline-notice info" role="status">
      <i data-lucide="info"></i>
      <span>Build ${BUILD_ID} | ${state.mode} | ${role} | ${escapeHtml(email)} | ${projects.length} project loaded</span>
    </div>
  `;
}

function renderProjectSaveNotice() {
  if (!state.lastProjectSave) {
    return "";
  }

  return `
    <div class="inline-notice ${escapeAttribute(state.lastProjectSave.tone)}" role="status">
      <i data-lucide="${state.lastProjectSave.tone === "error" ? "circle-alert" : "info"}"></i>
      <span>${escapeHtml(state.lastProjectSave.message)}</span>
    </div>
  `;
}

function renderTrackerDebugNotice(type, items) {
  const email = state.user?.email || state.profile?.email || "not signed in";
  const role = isAdmin() ? "admin" : state.profile?.role || "no role";
  const label = {
    file: "file row",
    project: "project tracker row",
    progress: "progress tracker row"
  }[type] || "tracker row";
  const count = Array.isArray(items) ? items.length : 0;

  return `
    <div class="inline-notice info" role="status">
      <i data-lucide="info"></i>
      <span>Build ${BUILD_ID} | ${state.mode} | ${role} | ${escapeHtml(email)} | ${count} ${escapeHtml(label)}${count === 1 ? "" : "s"} loaded</span>
    </div>
  `;
}

function renderTrackerSaveNotice(type) {
  const notice = state.lastTrackerSave[type];
  if (!notice) {
    return "";
  }

  return `
    <div class="inline-notice ${escapeAttribute(notice.tone)}" role="status">
      <i data-lucide="${notice.tone === "error" ? "circle-alert" : "info"}"></i>
      <span>${escapeHtml(notice.message)}</span>
    </div>
  `;
}

function renderMasterProjectTable(projects) {
  if (!projects.length) {
    return renderEmptyState("No master projects yet", "Create the first project here before using the trackers.");
  }

  return `
    <div class="table-wrap mobile-card-wrap">
      <table class="mobile-card-table">
        <thead>
          <tr>
            <th>Project Code</th>
            <th>Project Name</th>
            <th>Status</th>
            <th>Pelaksanaan</th>
            <th>Updated</th>
            ${isAdmin() ? `<th class="actions-column">Actions</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${projects.map(renderMasterProjectRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMasterProjectRow(project) {
  const status = normalizeProjectStatus(project.status);

  return `
    <tr>
      <td data-label="Project Code"><strong>${escapeHtml(project.projectCode)}</strong></td>
      <td data-label="Project Name" class="project-name-cell"><span>${escapeHtml(project.projectName)}</span></td>
      <td data-label="Status"><span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span></td>
      <td data-label="Pelaksanaan">${escapeHtml(project.pelaksanaan || "Konvensional Dalaman")}</td>
      <td data-label="Updated">${formatDate(projectLastUpdatedAt(project))}</td>
      ${
        isAdmin()
          ? `<td data-label="Actions">
              <div class="row-actions">
                <button class="icon-button" type="button" title="Edit" data-action="edit-master-project" data-id="${project.id}">
                  <i data-lucide="pencil"></i>
                </button>
                <button class="icon-button danger" type="button" title="Delete" data-action="delete-master-project" data-id="${project.id}">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </td>`
          : ""
      }
    </tr>
  `;
}

function renderFileForm() {
  const hasProjects = state.masterProjects.length > 0;
  return `
    <form class="form-grid" id="fileForm" novalidate>
      <input type="hidden" name="id" />
      <input type="hidden" name="projectId" />
      <label class="full-span">Project${renderProjectSearchInput("projectSearch", "fileFormProjectSearch")}</label>
      <div class="project-search-results full-span" data-project-search-results></div>
      <div class="linked-project-meta full-span" data-linked-project-meta>${renderLinkedProjectMeta(null)}</div>
      <label>Jilid<input name="jilid" type="number" min="0" step="1" value="0" required /></label>
      <label>Kabinet<input name="cabinet" required placeholder="X" /></label>
      <label>Para<input name="row" required placeholder="X" /></label>
      <label class="full-span">Notes<textarea name="notes" rows="3" placeholder="Latest movement or closing remark"></textarea></label>
      <button class="primary-button" type="button" data-action="save-file-item" ${hasProjects ? "" : "disabled"}>
        <i data-lucide="save"></i>
        <span>Save file</span>
      </button>
    </form>
  `;
}

function renderProjectForm() {
  const selectedProject = getDefaultMasterProject();
  const hasProjects = Boolean(selectedProject);
  const projectSubtracks = projectSubtracksForProject(selectedProject);
  return `
    <form class="form-grid" id="projectForm" novalidate>
      <input type="hidden" name="id" />
      <label>Project${renderProjectSelect("projectId", "projectFormProject", selectedProject?.id)}</label>
      <div class="linked-project-meta full-span" data-linked-project-meta>${renderLinkedProjectMeta(selectedProject)}</div>
      <label>Sub-tracking${renderSelect("subtrack", projectSubtracks, projectSubtracks[0])}</label>
      <label>Custom sub-tracking<input name="customSubtrack" placeholder="Optional" /></label>
      <label>Status${renderSelect("status", TRACKING_STATUSES, "Not Started")}</label>
      <label>Progress<input name="progress" type="number" min="0" max="100" value="0" /></label>
      <label>Owner<input name="owner" placeholder="Person responsible" /></label>
      <label>Target date<input name="dueDate" type="date" /></label>
      <label class="full-span">Notes<textarea name="notes" rows="3" placeholder="Latest update"></textarea></label>
      <button class="primary-button" type="button" data-action="save-project-item" ${hasProjects ? "" : "disabled"}>
        <i data-lucide="save"></i>
        <span>Save tracking</span>
      </button>
    </form>
  `;
}

function renderProgressForm() {
  const selectedProject = getDefaultMasterProject();
  const hasProjects = Boolean(selectedProject);
  const stageNames = progressStagesForProject(selectedProject);
  const progressSubtracks = progressSubtracksForProjectStage(selectedProject, stageNames[0]);
  return `
    <form class="form-grid" id="progressForm" novalidate>
      <input type="hidden" name="id" />
      <label>Project${renderProjectSelect("projectId", "progressFormProject", selectedProject?.id)}</label>
      <div class="linked-project-meta full-span" data-linked-project-meta>${renderLinkedProjectMeta(selectedProject)}</div>
      <label>Stage${renderSelect("stage", stageNames, stageNames[0], "data-progress-stage-select")}</label>
      <label>Sub-tracking${renderSelect("subtrack", progressSubtracks, progressSubtracks[0])}</label>
      <label>Custom sub-tracking<input name="customSubtrack" placeholder="Optional" /></label>
      <label>Status${renderSelect("status", TRACKING_STATUSES, "Not Started")}</label>
      <label>Progress<input name="progress" type="number" min="0" max="100" value="0" /></label>
      <label>Owner<input name="owner" placeholder="Person responsible" /></label>
      <label>Target date<input name="dueDate" type="date" /></label>
      <label class="full-span">Notes<textarea name="notes" rows="3" placeholder="Latest update"></textarea></label>
      <button class="primary-button" type="button" data-action="save-progress-item" ${hasProjects ? "" : "disabled"}>
        <i data-lucide="save"></i>
        <span>Save progress</span>
      </button>
    </form>
  `;
}

function renderProjectSeriesLauncher() {
  const selectedProject = getDefaultMasterProject();
  const hasProjects = Boolean(selectedProject);

  return `
    <section class="series-launcher mobile-searchable-section mobile-edit-section" data-series-type="project">
      <div class="series-header">
        <div class="section-heading">
          <p class="eyebrow">Project series</p>
          <h2>Start sub-tracking rows</h2>
        </div>
        <label class="series-project">
          Project
          ${renderProjectSelect("projectId", "projectSeriesProject", selectedProject?.id)}
        </label>
      </div>
      <div class="series-preview" data-series-preview>${renderProjectSeriesPreview(selectedProject)}</div>
      <button class="secondary-button" type="button" data-action="start-series" data-series-type="project" ${hasProjects ? "" : "disabled"}>
        <i data-lucide="plus"></i>
        <span>Start series</span>
      </button>
    </section>
  `;
}

function renderProgressSeriesLauncher() {
  const selectedProject = getDefaultMasterProject();
  const hasProjects = Boolean(selectedProject);
  const stages = progressStagesForProject(selectedProject);
  const selectedStage = stages[0] || "";

  return `
    <section class="series-launcher mobile-searchable-section mobile-edit-section" data-series-type="progress">
      <div class="series-header">
        <div class="section-heading">
          <p class="eyebrow">Progress series</p>
          <h2>Start sub-tracking rows</h2>
        </div>
        <div class="series-controls">
          <label class="series-project">
            Project
            ${renderProjectSelect("projectId", "progressSeriesProject", selectedProject?.id)}
          </label>
          <label class="series-project">
            Stage
            ${renderSelect("stage", stages, selectedStage, "id=\"progressSeriesStage\" data-progress-stage-select")}
          </label>
        </div>
      </div>
      <div class="series-preview" data-series-preview>${renderProgressSeriesPreview(selectedProject, selectedStage)}</div>
      <button class="secondary-button" type="button" data-action="start-series" data-series-type="progress" ${hasProjects ? "" : "disabled"}>
        <i data-lucide="plus"></i>
        <span>Start series</span>
      </button>
    </section>
  `;
}

function renderProjectSeriesPreview(project) {
  if (!project) {
    return renderEmptyState("No master projects yet", "Create a project in List of Projects first.");
  }

  const subtracks = projectSubtracksForProject(project);
  return `
    <article class="template-card">
      <div>
        <p class="card-kicker">${escapeHtml(project.pelaksanaan)}</p>
        <h3>${escapeHtml(projectLabel(project))}</h3>
        <div class="chip-list">${subtracks.map((track) => `<span>${escapeHtml(track)}</span>`).join("")}</div>
      </div>
    </article>
  `;
}

function renderProgressSeriesPreview(project, stage) {
  if (!project) {
    return renderEmptyState("No master projects yet", "Create a project in List of Projects first.");
  }

  const subtracks = progressSubtracksForProjectStage(project, stage);
  return `
    <article class="template-card">
      <div>
        <p class="card-kicker">${escapeHtml(projectLabel(project))}</p>
        <h3>${escapeHtml(stage || "Progress stage")}</h3>
        <div class="chip-list">${subtracks.map((track) => `<span>${escapeHtml(track)}</span>`).join("")}</div>
      </div>
    </article>
  `;
}

function renderProjectTemplate(category, subtracks) {
  return `
    <article class="template-card">
      <div>
        <h3>${escapeHtml(category)}</h3>
        <div class="chip-list">${subtracks.map((track) => `<span>${escapeHtml(track)}</span>`).join("")}</div>
      </div>
      <button class="secondary-button" type="button" data-action="start-series" data-series-type="project" data-category="${escapeAttribute(category)}">
        <i data-lucide="plus"></i>
        <span>Start series</span>
      </button>
    </article>
  `;
}

function renderProgressTemplate(category, stage, subtracks) {
  return `
    <article class="template-card">
      <div>
        <p class="card-kicker">${escapeHtml(category)}</p>
        <h3>${escapeHtml(stage)}</h3>
        <div class="chip-list">${subtracks.map((track) => `<span>${escapeHtml(track)}</span>`).join("")}</div>
      </div>
      <button class="secondary-button" type="button" data-action="start-series" data-series-type="progress" data-category="${escapeAttribute(category)}" data-stage="${escapeAttribute(stage)}">
        <i data-lucide="plus"></i>
        <span>Start series</span>
      </button>
    </article>
  `;
}

function renderFileTable(items) {
  if (!items.length) {
    return renderEmptyState("No files in this status", "Rows appear here as the team updates them.");
  }

  return `
    <div class="table-wrap mobile-card-wrap">
      <table class="mobile-card-table">
        <thead>
          <tr>
            <th>Project Code</th>
            <th>Project</th>
            <th>Jilid</th>
            <th>Location</th>
            <th>Updated</th>
            ${isAdmin() ? `<th class="actions-column">Actions</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${items.map(renderFileRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFileRow(item) {
  const project = getProjectForItem(item);
  const location = item.location
    ? isLikelyUrl(item.location)
      ? `<a href="${escapeAttribute(item.location)}" target="_blank" rel="noreferrer">${escapeHtml(item.location)}</a>`
      : escapeHtml(item.location)
    : `<span class="muted">Not set</span>`;

  return `
    <tr>
      <td data-label="Project Code"><strong>${escapeHtml(projectCodeForItem(item, project))}</strong></td>
      <td data-label="Project">${escapeHtml(projectNameForItem(item, project))}</td>
      <td data-label="Jilid">${escapeHtml(item.fileName || item.title)}</td>
      <td data-label="Location" class="location-cell">${location}</td>
      <td data-label="Updated">${formatDate(item.updatedAt)}</td>
      ${
        isAdmin()
          ? `<td data-label="Actions">
              <div class="row-actions">
                <button class="icon-button" type="button" title="Edit" data-action="edit-item" data-id="${item.id}">
                  <i data-lucide="pencil"></i>
                </button>
                <button class="icon-button danger" type="button" title="Delete" data-action="delete-item" data-id="${item.id}">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </td>`
          : ""
      }
    </tr>
  `;
}

function renderTrackingBoard(items, type) {
  if (!items.length) {
    return `<section class="table-section mobile-searchable-section mobile-result-section">${renderEmptyState("No tracking rows yet", "Create a series or add a manual row.")}</section>`;
  }

  const categories = type === "project" ? Object.keys(PROJECT_SERIES) : Object.keys(PROGRESS_SERIES);
  return `
    <section class="board-grid mobile-searchable-section mobile-result-section">
      ${categories
        .map((category) => {
          const categoryItems = items.filter((item) => categoryForItem(item) === category);
          return renderCategoryColumn(category, categoryItems, type);
        })
        .join("")}
    </section>
  `;
}

function renderCategoryColumn(category, items, type) {
  const complete = items.filter((item) => item.status === "Completed").length;
  const percent = items.length ? Math.round((complete / items.length) * 100) : 0;

  return `
    <article class="board-column">
      <div class="board-heading">
        <div>
          <h3>${escapeHtml(category)}</h3>
          <p>${items.length} rows</p>
        </div>
        <span class="mini-progress">${percent}%</span>
      </div>
      <div class="progress-bar" aria-hidden="true"><span style="width: ${percent}%"></span></div>
      <div class="tracking-list">
        ${
          items.length
            ? items.map((item) => renderTrackingCard(item, type)).join("")
            : `<div class="empty-mini">No rows</div>`
        }
      </div>
    </article>
  `;
}

function renderTrackingCard(item, type) {
  const project = getProjectForItem(item);
  return `
    <article class="tracking-card">
      <div class="tracking-card-head">
        <div>
          <p class="card-kicker">${escapeHtml(projectLabelForItem(item, project))}</p>
          <h4>${escapeHtml(item.subtrack || item.title)}</h4>
        </div>
        <span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status || "Not Started")}</span>
      </div>
      ${type === "progress" ? `<p class="stage-label">${escapeHtml(item.stage || "General")}</p>` : ""}
      <div class="progress-line">
        <span style="width: ${clamp(Number(item.progress || 0), 0, 100)}%"></span>
      </div>
      <div class="tracking-meta">
        <span><i data-lucide="user-round"></i>${escapeHtml(item.owner || "Unassigned")}</span>
        <span><i data-lucide="calendar-days"></i>${escapeHtml(item.dueDate || "No date")}</span>
      </div>
      ${item.notes ? `<p class="notes">${escapeHtml(item.notes)}</p>` : ""}
      ${
        isAdmin()
          ? `<div class="card-actions">
              <button class="icon-button" type="button" title="Edit" data-action="edit-item" data-id="${item.id}">
                <i data-lucide="pencil"></i>
              </button>
              <button class="icon-button danger" type="button" title="Delete" data-action="delete-item" data-id="${item.id}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderTeamMember(member) {
  const editable = isAdmin();
  return `
    <article class="team-member">
      <div class="avatar">${escapeHtml(initials(member.displayName || member.email))}</div>
      <div class="team-copy">
        <h3>${escapeHtml(member.displayName || "Team member")}</h3>
        <p>${escapeHtml(member.email || "No email")}</p>
      </div>
      <div class="team-controls">
        <select data-user-role="${member.id}" ${editable ? "" : "disabled"}>
          ${["admin", "colleague"].map((role) => `<option value="${role}" ${member.role === role ? "selected" : ""}>${role}</option>`).join("")}
        </select>
        <select data-user-status="${member.id}" ${editable ? "" : "disabled"}>
          ${["active", "paused"].map((status) => `<option value="${status}" ${member.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>
    </article>
  `;
}

function renderMetric(label, value, icon, hint) {
  return `
    <article class="metric-card">
      <div class="metric-icon"><i data-lucide="${icon}"></i></div>
      <div>
        <p>${escapeHtml(label)}</p>
        <strong>${escapeHtml(String(value))}</strong>
        <span>${escapeHtml(hint)}</span>
      </div>
    </article>
  `;
}

function renderActivityRow(item) {
  const project = getProjectForItem(item);
  const icon = item.type === "file" ? "folder-open" : item.type === "project" ? "kanban-square" : "bar-chart-3";
  const label = item.type === "file" ? item.fileName || item.title : item.subtrack || item.title;
  return `
    <article class="activity-row">
      <div class="metric-icon small"><i data-lucide="${icon}"></i></div>
      <div>
        <h3>${escapeHtml(label)}</h3>
        <p>${escapeHtml(projectLabelForItem(item, project))} · ${escapeHtml(item.updatedBy || "Team")} · ${formatDate(item.updatedAt)}</p>
      </div>
      <span class="status-pill ${statusClass(item.fileStatus || item.status)}">${escapeHtml(item.fileStatus || item.status || "Updated")}</span>
    </article>
  `;
}

function renderCategoryProgress(category) {
  const categoryItems = state.items.filter((item) => categoryForItem(item) === category);
  const done = categoryItems.filter((item) => item.status === "Completed").length;
  const percent = categoryItems.length ? Math.round((done / categoryItems.length) * 100) : 0;

  return `
    <article class="category-row">
      <div>
        <h3>${escapeHtml(category)}</h3>
        <p>${done} of ${categoryItems.length} completed</p>
      </div>
      <div class="category-progress">
        <span>${percent}%</span>
        <div class="progress-bar"><span style="width: ${percent}%"></span></div>
      </div>
    </article>
  `;
}

function renderEmptyState(title, copy) {
  return `
    <div class="empty-state">
      <i data-lucide="inbox"></i>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(copy)}</p>
    </div>
  `;
}

function renderProjectSelect(name, id, selectedId = "") {
  const projects = sortedMasterProjects();
  const selected = selectedId || projects[0]?.id || "";

  if (!projects.length) {
    return `
      <select id="${escapeAttribute(id)}" name="${escapeAttribute(name)}" data-master-project-select disabled>
        <option value="">No master projects</option>
      </select>
    `;
  }

  return `
    <select id="${escapeAttribute(id)}" name="${escapeAttribute(name)}" data-master-project-select required>
      ${projects
        .map(
          (project) => `
            <option value="${escapeAttribute(project.id)}" ${project.id === selected ? "selected" : ""}>
              ${escapeHtml(projectLabel(project))}
            </option>
          `
        )
        .join("")}
    </select>
  `;
}

function renderProjectSearchInput(name, id, selectedProject = null) {
  const projects = sortedMasterProjects();
  const selectedValue = selectedProject ? projectLabel(selectedProject) : "";

  return `
    <input
      id="${escapeAttribute(id)}"
      name="${escapeAttribute(name)}"
      data-master-project-search
      placeholder="Search project code or project name"
      value="${escapeAttribute(selectedValue)}"
      autocomplete="off"
      ${projects.length ? "required" : "disabled"}
    />
  `;
}

function renderProjectSearchResults(query, selectedId = "") {
  const cleanQuery = cleanInput(query);
  if (!cleanQuery) {
    return "";
  }

  const matches = searchMasterProjects(cleanQuery).slice(0, 6);
  if (!matches.length) {
    return `<div class="project-result-empty">No project match</div>`;
  }

  return matches
    .map(
      (project) => `
        <button
          class="project-result ${project.id === selectedId ? "is-selected" : ""}"
          type="button"
          data-action="select-search-project"
          data-id="${escapeAttribute(project.id)}"
        >
          <strong>${escapeHtml(project.projectCode || "-")}</strong>
          <span>${escapeHtml(project.projectName || "Untitled project")}</span>
        </button>
      `
    )
    .join("");
}

function renderLinkedProjectMeta(project) {
  if (!project) {
    return `<span>No project selected</span>`;
  }

  return `
    <span><strong>Code</strong> ${escapeHtml(project.projectCode || "-")}</span>
    <span><strong>Status</strong> ${escapeHtml(normalizeProjectStatus(project.status))}</span>
    <span><strong>Pelaksanaan</strong> ${escapeHtml(project.pelaksanaan || "Konvensional Dalaman")}</span>
  `;
}

function renderSelect(name, options, selected, attributes = "") {
  return `
    <select name="${name}" ${attributes}>
      ${options
        .map((option) => `<option value="${escapeAttribute(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`)
        .join("")}
    </select>
  `;
}

function renderSync() {
  els.syncIndicator.className = `sync-indicator ${state.sync.tone}`;
  els.syncLabel.textContent = state.sync.label;
  els.syncIndicator.title = state.sync.label;
}

function setSync(label, tone = "idle") {
  state.sync = { label, tone, updatedAt: Date.now() };
  if (els.syncIndicator) {
    renderSync();
  }
}

function setPassiveSync(label, tone = "idle") {
  const errorIsFresh = state.sync.tone === "error" && Date.now() - state.sync.updatedAt < 10000;
  if (!errorIsFresh) {
    setSync(label, tone);
  }
}

function setTrackerNotice(type, tone, message) {
  state.lastTrackerSave[type] = { tone, message };
}

function reportRuntimeError(error) {
  if (!error) {
    return;
  }

  console.error(error);
  setSync(friendlyFirebaseError(error), "error");
}

function filteredItems(type = "") {
  const lookupFilter = activeLookupFilter();
  return state.items
    .filter((item) => (type ? item.type === type : true))
    .filter((item) => {
      if (!lookupFilter) {
        return true;
      }

      const project = getProjectForItem(item);
      return [projectNameForItem(item, project), projectCodeForItem(item, project)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(lookupFilter);
    })
    .sort(sortByUpdatedAt);
}

function filteredMasterProjects() {
  const lookupFilter = activeLookupFilter();
  return sortedMasterProjects().filter((project) => {
    if (!lookupFilter) {
      return true;
    }

    return [project.projectName, project.projectCode]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(lookupFilter);
  });
}

function activeLookupFilter() {
  if (!state.filter) {
    return "";
  }

  if (!window.matchMedia) {
    return state.filter;
  }

  return window.matchMedia("(max-width: 820px)").matches ? state.filter : "";
}

function searchFileLocationItems(query) {
  const cleanQuery = cleanInput(query).toLowerCase();
  if (!cleanQuery) {
    return [];
  }

  return state.items
    .filter((item) => item.type === "file")
    .filter((item) => {
      const project = getProjectForItem(item);
      return [
        projectCodeForItem(item, project),
        projectNameForItem(item, project),
        item.fileName,
        item.title,
        item.location,
        normalizeFileStatus(item.fileStatus)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery);
    })
    .sort(sortFileLocationItems);
}

function sortFileLocationItems(a, b) {
  const projectA = getProjectForItem(a);
  const projectB = getProjectForItem(b);
  const aSort = projectCodeSortParts(projectCodeForItem(a, projectA));
  const bSort = projectCodeSortParts(projectCodeForItem(b, projectB));

  if (aSort.trailingNumber !== bSort.trailingNumber) {
    return aSort.trailingNumber - bSort.trailingNumber;
  }

  const codeCompare = aSort.code.localeCompare(bSort.code, "en-MY", { numeric: true, sensitivity: "base" });
  if (codeCompare !== 0) {
    return codeCompare;
  }

  return normalizeJilid(b.jilid) - normalizeJilid(a.jilid);
}

function sortByUpdatedAt(a, b) {
  return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
}

function persistLocal() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      masterProjects: state.masterProjects,
      items: state.items,
      users: state.users,
      vehicleInfo: state.vehicleInfo
    })
  );
}

function getFirebaseConfig() {
  if (isFirebaseConfigured(window.HAFIZE_FIREBASE_CONFIG)) {
    localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
    return window.HAFIZE_FIREBASE_CONFIG;
  }

  const localConfig = safeJsonParse(localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY), null);
  return localConfig || {};
}

function getAdminEmails() {
  return Array.isArray(window.HAFIZE_ADMIN_EMAILS)
    ? window.HAFIZE_ADMIN_EMAILS.map((email) => String(email).trim().toLowerCase()).filter(
        (email) => email && !email.includes("example.com")
      )
    : [];
}

function projectDocumentId(project) {
  return (
    String(project?.projectCode || project?.projectName || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || crypto.randomUUID()
  );
}

function normalizeProjectStatus(status) {
  const value = cleanInput(status);
  const lowerValue = value.toLowerCase();
  if (!value || ["active", "aktif", "running"].includes(lowerValue)) {
    return "Aktif";
  }
  if (["serah", "closed"].includes(lowerValue)) {
    return "Serah";
  }

  return PROJECT_MASTER_STATUSES.find((option) => option.toLowerCase() === lowerValue) || "Aktif";
}

function normalizePelaksanaan(value) {
  const cleanValue = cleanInput(value);
  if (!cleanValue) {
    return "Konvensional Dalaman";
  }

  return PELAKSANAAN_OPTIONS.find((option) => option.toLowerCase() === cleanValue.toLowerCase()) || "Konvensional Dalaman";
}

function normalizeFileStatus(status) {
  const value = String(status || "Running").trim();
  if (value === "Open") {
    return "Running";
  }

  return FILE_STATUSES.includes(value) ? value : "Running";
}

function normalizeMasterProject(project) {
  const projectData = project || {};

  return {
    ...projectData,
    status: normalizeProjectStatus(projectData?.status),
    pelaksanaan: normalizePelaksanaan(projectData?.pelaksanaan)
  };
}

function isVehicleProjectInfoRecord(record) {
  return record?.id === VEHICLE_INFO_DOC_ID || record?.type === VEHICLE_INFO_TYPE;
}

function normalizeVehicleProjectInfo(info) {
  const infoData = info || {};
  return {
    ...VEHICLE_INFO_DEFAULTS,
    id: VEHICLE_INFO_DOC_ID,
    type: VEHICLE_INFO_TYPE,
    projectName: cleanInput(infoData.projectName),
    contractNo: cleanInput(infoData.contractNo),
    contractor: cleanInput(infoData.contractor),
    driverNamePhone: cleanInput(infoData.driverNamePhone),
    vehicleRegistration: cleanInput(infoData.vehicleRegistration),
    vehicleType: cleanInput(infoData.vehicleType),
    responsibleOfficer: cleanInput(infoData.responsibleOfficer),
    officeName: cleanInput(infoData.officeName) || VEHICLE_INFO_DEFAULTS.officeName,
    reviewYear: normalizeReviewYear(infoData.reviewYear),
    updatedAt: infoData.updatedAt || "",
    updatedBy: cleanInput(infoData.updatedBy),
    updatedByUid: cleanInput(infoData.updatedByUid)
  };
}

function normalizeReviewYear(value) {
  const year = Number.parseInt(cleanInput(value), 10);
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    return String(year);
  }

  return VEHICLE_INFO_DEFAULTS.reviewYear;
}

function normalizeTrackerItem(item) {
  const itemData = item || {};

  if (itemData?.type !== "file") {
    return itemData;
  }

  const jilid = normalizeJilid(itemData.jilid ?? inferJilidFromFileName(itemData.fileName, itemData.projectCode));
  const locationParts = parseHardcopyLocation(itemData.location);
  const project = getMasterProjectById(itemData.projectId);
  const hasProjectCode = Boolean(project?.projectCode || itemData.projectCode);
  const fileName = hasProjectCode
    ? formatJilidName(project || itemData, jilid)
    : itemData.fileName || formatJilidName(project || itemData, jilid);
  const cabinet = itemData.cabinet || locationParts.cabinet || "Pending";
  const row = itemData.row || locationParts.row || "Pending";

  return {
    ...itemData,
    jilid,
    fileName,
    title: fileName,
    fileStatus: normalizeFileStatus(itemData.fileStatus),
    cabinet,
    row,
    location: formatHardcopyLocation(cabinet, row)
  };
}

function projectLastUpdatedAt(project) {
  const projectUpdatedAt = project?.updatedAt || "";
  const linkedUpdatedAt = linkedItemsForProject(project)
    .map((item) => item.updatedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  if (!projectUpdatedAt) {
    return linkedUpdatedAt;
  }

  if (!linkedUpdatedAt) {
    return projectUpdatedAt;
  }

  return new Date(linkedUpdatedAt) > new Date(projectUpdatedAt) ? linkedUpdatedAt : projectUpdatedAt;
}

function linkedItemsForProject(project) {
  if (!project) {
    return [];
  }

  return state.items.filter(
    (item) =>
      item.projectId === project.id ||
      (!item.projectId &&
        ((item.projectCode && item.projectCode === project.projectCode) ||
          (item.projectName && item.projectName === project.projectName)))
  );
}

function resolveMasterProjectFromSearch(value, { allowPartial = false } = {}) {
  const query = cleanInput(value).toLowerCase();
  if (!query) {
    return null;
  }

  const exactMatch =
    state.masterProjects.find((project) => project.id === query) ||
    state.masterProjects.find((project) => projectLabel(project).toLowerCase() === query) ||
    state.masterProjects.find((project) => String(project.projectCode || "").toLowerCase() === query) ||
    state.masterProjects.find((project) => String(project.projectName || "").toLowerCase() === query);

  if (exactMatch || !allowPartial) {
    return exactMatch || null;
  }

  const partialMatches = state.masterProjects.filter((project) =>
    [projectLabel(project), project.projectCode, project.projectName]
      .filter(Boolean)
      .some((valuePart) => String(valuePart).toLowerCase().includes(query))
  );

  return partialMatches.length === 1 ? partialMatches[0] : null;
}

function searchMasterProjects(value) {
  const query = cleanInput(value).toLowerCase();
  const projects = sortedMasterProjects();
  if (!query) {
    return [];
  }

  return projects.filter((project) =>
    [project.projectCode, project.projectName, projectLabel(project)]
      .filter(Boolean)
      .some((valuePart) => String(valuePart).toLowerCase().includes(query))
  );
}

function normalizeJilid(value) {
  const numeric = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function formatJilidName(project, jilid) {
  const code = project?.projectCode || "Project";
  const normalized = normalizeJilid(jilid);
  return normalized <= 1 ? code : `${code} Jilid ${normalized}`;
}

function inferJilidFromFileName(fileName, projectCode = "") {
  const value = String(fileName || "");
  const match = value.match(/jilid\s+(\d+)/i);
  if (match) {
    return Number.parseInt(match[1], 10);
  }

  return value && projectCode && value.trim() !== projectCode ? 0 : 0;
}

function formatHardcopyLocation(cabinet, row) {
  const cleanCabinet = cleanInput(cabinet);
  const cleanRow = cleanInput(row);
  if (!cleanCabinet && !cleanRow) {
    return "";
  }

  return `Kabinet ${cleanCabinet || "-"}, Para ${cleanRow || "-"}`;
}

function parseHardcopyLocation(location) {
  const value = String(location || "");
  const match = value.match(/(?:cabinet|kabinet)\s+(.+?)\s*,\s*(?:row|para)\s+(.+)/i);
  if (!match) {
    return {
      cabinet: "",
      row: ""
    };
  }

  return {
    cabinet: match[1].trim(),
    row: match[2].trim()
  };
}

function nextJilidNumber(jilid) {
  const normalized = normalizeJilid(jilid);
  return normalized <= 1 ? 2 : normalized + 1;
}

function nextJilidForProject(project) {
  const files = linkedItemsForProject(project).filter((item) => item.type === "file");
  if (!files.length) {
    return 0;
  }

  const maxJilid = Math.max(...files.map((item) => normalizeJilid(item.jilid ?? inferJilidFromFileName(item.fileName, item.projectCode))));
  return nextJilidNumber(maxJilid);
}

function mergeById(current, incoming) {
  const incomingIds = new Set(incoming.map((entry) => entry.id));
  return [...incoming, ...current.filter((entry) => !incomingIds.has(entry.id))];
}

function isSeededRecord(entry) {
  return String(entry?.id || "").startsWith(SEEDED_RECORD_PREFIX);
}

async function deleteSeededDocuments(collectionName, ids) {
  if (!ids.length || state.mode !== "firebase" || !state.db || !isAdmin()) {
    return;
  }

  try {
    const batch = state.sdk.writeBatch(state.db);
    ids.forEach((id) => {
      batch.delete(state.sdk.doc(state.db, collectionName, id));
    });
    await batch.commit();
    setPassiveSync("Removed old sample data", "online");
  } catch (error) {
    console.error(error);
  }
}

function sortedMasterProjects() {
  return [...state.masterProjects].sort((a, b) => {
    const aSort = projectCodeSortParts(a.projectCode);
    const bSort = projectCodeSortParts(b.projectCode);

    if (aSort.trailingNumber !== bSort.trailingNumber) {
      return aSort.trailingNumber - bSort.trailingNumber;
    }

    const codeCompare = aSort.code.localeCompare(bSort.code, "en-MY", { numeric: true, sensitivity: "base" });
    if (codeCompare !== 0) {
      return codeCompare;
    }

    return String(a.projectName || "").localeCompare(String(b.projectName || ""), "en-MY", {
      numeric: true,
      sensitivity: "base"
    });
  });
}

function projectCodeSortParts(projectCode) {
  const code = String(projectCode || "").trim().toUpperCase();
  const match = code.match(/(\d+)\s*$/);

  return {
    code,
    trailingNumber: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
  };
}

function getDefaultMasterProject() {
  return sortedMasterProjects()[0] || null;
}

function getMasterProjectById(id) {
  return state.masterProjects.find((project) => project.id === String(id || "")) || null;
}

function getProjectForItem(item) {
  return getMasterProjectById(item?.projectId);
}

function projectFields(project) {
  if (!project) {
    return {};
  }

  return {
    projectId: project.id,
    projectName: project.projectName,
    projectCode: project.projectCode,
    projectStatus: normalizeProjectStatus(project.status),
    category: project.pelaksanaan,
    pelaksanaan: project.pelaksanaan
  };
}

function projectLabel(project) {
  if (!project) {
    return "No project";
  }

  return project.projectCode ? `${project.projectCode} - ${project.projectName}` : project.projectName;
}

function projectNameForItem(item, project = getProjectForItem(item)) {
  return project?.projectName || item?.projectName || "No project";
}

function projectCodeForItem(item, project = getProjectForItem(item)) {
  return project?.projectCode || item?.projectCode || "-";
}

function projectLabelForItem(item, project = getProjectForItem(item)) {
  return project ? projectLabel(project) : projectLabel({ projectName: item?.projectName || "No project", projectCode: item?.projectCode || "" });
}

function categoryForItem(item) {
  return getProjectForItem(item)?.pelaksanaan || item?.category || item?.pelaksanaan || "Konvensional Dalaman";
}

function projectSubtracksForProject(project) {
  const category = project?.pelaksanaan || "Konvensional Dalaman";
  return PROJECT_SERIES[category] || [];
}

function progressStagesForProject(project) {
  const category = project?.pelaksanaan || "Konvensional Dalaman";
  return Object.keys(PROGRESS_SERIES[category] || {});
}

function progressSubtracksForProjectStage(project, stage) {
  const category = project?.pelaksanaan || "Konvensional Dalaman";
  const stages = PROGRESS_SERIES[category] || {};
  const selectedStage = stage && stages[stage] ? stage : Object.keys(stages)[0];
  return stages[selectedStage] || [];
}

function isFirebaseConfigured(config) {
  return Boolean(
    config &&
      config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId &&
      !String(config.projectId).includes("your-project-id")
  );
}

function normalizeFirebaseData(data) {
  return Object.fromEntries(
    Object.entries(data || {}).map(([key, value]) => {
      if (value?.toDate) {
        return [key, value.toDate().toISOString()];
      }
      return [key, value];
    })
  );
}

function cleanObject(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null)
  );
}

function viewForItemType(type) {
  return {
    file: "files",
    project: "projects",
    progress: "progress"
  }[type] || "overview";
}

function cleanInput(value) {
  return String(value || "").trim();
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function isConfiguredAdminUser(user = state.user) {
  const email = String(user?.email || state.profile?.email || "").trim().toLowerCase();
  return Boolean(email && getAdminEmails().includes(email));
}

function isAdmin() {
  return state.profile?.role === "admin" || isConfiguredAdminUser();
}

function friendlyFirebaseError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");

  if (code.includes("permission-denied") || message.includes("Missing or insufficient permissions")) {
    return "Firestore blocked save: check rules are published";
  }

  if (code.includes("unauthenticated")) {
    return "Please sign in again";
  }

  if (code.includes("invalid-api-key")) {
    return "Firebase API key rejected";
  }

  return message.replace("Firebase: ", "") || "Firebase error";
}

function statusClass(status = "") {
  return `status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(value);
}

function initials(value = "") {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "H";
}

function formatDate(value) {
  if (!value) {
    return "Not synced";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

window.addEventListener("beforeunload", clearSubscriptions);
