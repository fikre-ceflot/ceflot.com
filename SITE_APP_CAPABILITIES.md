# Mobile Site Operations App — Technical Capabilities & Android Replatforming Specification

This specification compiles all current functional capabilities, UI hierarchies, database schemas, and state flows of the **Field Site App** (`SiteApp.tsx`). It is designed as a complete master blueprint to implement and compile the native Android (Kotlin / Jetpack Compose) counterpart with high architectural precision.

---

## 1. Architectural Philosophy, Graphics Layout & Decluttered Design System

The Site App is designed as a focused, high-performance, and high-density mobile interface. It prioritizes low visual friction, extreme typographic legibility, and modern minimalist layouts that eliminate screen-noise for field workers operating under variable daylight and harsh onsite conditions.

### A. Minimalist Graphics Layout Principles (Decluttered UI)
* **Visual Quietness & Zero-Value Suppression**: To keep the layout highly readable under variable outdoor glare, numeric columns such as Contract Quantity and Progress Percentage are completely suppressed (rendered empty/blank) if they are equal to `0`, `0.0`, or represent top-level structural containers. No secondary zeros flood the ledger grid.
* **Redundant Status & Noise Removal**: Read-only warning signals, redundant padlock SVGs, or system logging logs are hidden under parent rows, showing only active interactive fields depending on the operator's current workflow scope.
* **Typographic Hierarchy & Eye-Safe Contrast**: Elegant pairing of high-contrast **Inter** (sans-serif) for general labels, display headers, and functional controls alongside **JetBrains Mono** (monospace) for technical material codes, numeric logs, work items, and timestamps.
* **Negative Space and Balance**: Uses generous negative space padding to distinguish cards instead of heavy physical borders. Includes subtle translucent overlay fills (`bg-surface-2/40` on charcoal sub-surfaces) against an eye-safe dark backdrop (`bg-surface-base`), leaving outer boundaries elegant, clean, and completely uncluttered.
* **Color Psychology Constraints**: Focuses strictly on a cohesive slate/charcoal color theme. Status colors are applied with high clinical discretion:
  - `Emerald` for completed milestones or verified receipts.
  - `Amber` for active progress or outstanding issues.
  - `Rose` for critical project-stopper alerts or material shortages.

### B. Shell & Layout Contexts
1. **Office Access Mode (Embedded)**: Rendered inside a web dashboard segment with an immersive responsive chassis container (`relative w-full h-[750px] max-w-md mx-auto rounded-[3rem] border border-border-subtle shadow-2xl overflow-hidden`).
2. **Field Operator Mode (Stand-alone)**: Rendered in a simulated high-fidelity mobile smartphone wrapper with a top navigation pill (notch simulation), a scrollable main canvas, and a sticking bottom navigation action bar.

### C. Android Equivalent Design Guidance
* **Activity Design**: Single-Activity Architecture (`MainActivity`) using **Jetpack Compose Navigation**.
* **Base Layout Framework**: Scaffold with a coordinated bottom sheet handle, custom status-bar colors matching the ambient container, and full system inset paddings (`Modifier.windowInsetsPadding(WindowInsets.safeDrawing)`).

---

## 2. Supabase Authentication & Multi-Role Persona System

The application connects directly to the Supabase Auth system to manage operator credentials, secure data boundaries, and determine interface layouts.

### A. Supabase Authentication & Login Flow
1. **User Sign-In Screen**: A distraction-free, elegant log-in form requiring e-mail credentials and an encrypted user password. Other unrelated sidebar elements or settings panels are masked out completely while the user authenticates.
2. **Profile & RBAC Resolution**: Upon a successful database validation handshake, the client retrieves the authenticated user's profile from the `user_profiles` database table corresponding to `auth.users.id`.
3. **Tenant & Project Scoping**: The profile resolves a specific `tenant_id` and a scoped `role`, restricting all query operations via Row-Level Security (RLS) and client database filters so operators only see database entities matching their domain.

### B. Persona Emulation & Admin Console
A dynamic administrative role select dropdown `<select>` is provided at the header of the app for `tenant_admin` accounts, allowing real-time switching/emulation of any of the following site roles for testing and debugging:

| Role Persona | Role Code | Primary Contextual Focus | Available Actions & Wizards |
| :--- | :--- | :--- | :--- |
| **Site Encoder** | `site_encoder` | Daily site output recording, tracking progress, and log synchronization. | Submit Daily Report, View Progress Logs, File Alert, Live Technical Trade Guides. |
| **Storeman** | `storeman` | Materials verification, warehouse inventory ins/outs, stock auditing. | GRN Received notes, Material Issue notes, Active Material Inventory ledger. |
| **Procurement Specialist** | `procurement` | Materials requests, verifying items supply chains, matching purchase bills. | Supply chain tracking, Purchase Order receipts, Direct materials receipts. |
| **Project Superintendent / Admin**| `tenant_admin` | Global override authority, auditing records, approval workflows. | Multi-view switching dropdown, full history details, alert override, delete logs. |

---

## 3. Screen-By-Screen Functional Blueprint

### A. Core Welcome Dashboard
* **Dynamic Header**: Greeting displaying the operator's first name, active Project Name, current locale date, and immediate notifications mailbox button (bell icon with an active-count red badge).
* **Persona Actions Grid (The 3-Button Tool)**: A responsive grid layout of rounded cards providing single-tap access to primary tasks depending on active role:
  * *Site Encoder Mode*:
    1. **Log Daily Progress** (launches multi-step report wizard)
    2. **View Field History** (navigates to historical log audit list)
    3. **File Alert** (high priority project-stopper logging)
  * *Storeman Mode*:
    1. **Receive Materials (GRN)** (logs raw materials inflow with matching vendor codes)
    2. **Issue Materials** (tracks raw inventory release with matching sub-contractor codes)
    3. **Ledger / Stock Audit** (displays active materials balances on site)
* **Recent Activity Feed**: Previews the last 3 logged reports. Shows weather icons, dates, summary snippets, and chevron elements allowing instant drilldown### B. Multi-Step Daily Site Report Wizard
This is the core complex state-wizard of the application. It consists of **7 sequential steps** with validation checkpoints.

```
┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  Step 1:     │     │  Step 2:     │     │  Step 3:    │
│  Weather,    │ ──> │  Execution   │ ──> │  Scope /    │
│  Shift, Notes│     │  Resp. (Sub) │     │  BOQ Item   │
└──────────────┘     └──────────────┘     └─────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  Step 7:     │     │  Step 6:     │     │  Step 4:    │
│  Review &    │ <── │  Equipment / │ <── │  Material   │
│  Submission  │     │  Machinery   │     │  Consump.   │
└──────────────┘     └──────────────┘     └─────────────┘
                             ▲
                             │
                      ┌──────────────┐
                      │  Step 5:     │
                      │  Manpower /  │
                      │  Crafts Logs │
                      └──────────────┘
```

#### Step 1: Pre-requisites & Environment
* **Weather Presets**: Exclusive selection buttons: `Sunny` (clear sky/accent yellow), `Rainy` (disrupted progress/indigo-blue), `Cold` (chilly working conditions/purple), `Humid` (high temperature/orange).
* **Logs & Atmosphere Metadata**: Shift identifier (Default Day shift), text input field for overall remarks, wind velocity (optional), and delay annotations.

#### Step 2: Execution Responsibility
* Select whether a Subcontractor or Daily Basis Labor is responsible.
* **Filtered Subcontractor Selection**: Filters and displays **ONLY** subcontractor companies who have active assignments/contracts matched to the current project, keeping the interface clean of unrelated companies and ensuring clean logistics.
* Blocks navigation to Step 3 until a subcontractor or a labor grade is successfully highlighted.

#### Step 3: Scope Assignment & Bill of Quantities (BOQ) Items
* Renders a scrollable list of assigned building activities (BOQ items) synced directly from the project database.
* Items list displays inline indicators showing each item's current progress percentage (e.g. `0%`, `45%`, `100%`) utilizing color-coded badges indicating execution status (completed green, active amber, unstarted gray).
* Encoders select the target activity and input specific remarks.

#### Step 4: Material Deliveries & In-Use Inventory
* Tracks daily materials consumed across project assignments.
* Supports selecting items directly from site inventory lists (aggregates database material master files) with matching quantity values used on the active date.

#### Step 5: Manpower & Labours
* Lets operators record details of all active crews on site.
* Users select labour category codes (e.g., Carpenter, Block-mason, Plumber, Helper, Supervisor) and supply corresponding **Headcount** (integer) and **Worked Hours** (float).
* Automated summation computes overall man-hours used.

#### Step 6: Equipment Logs & Runtime Tracker
* Logs machinery runtimes. For each piece of machinery on site (e.g., Excavator, Tower Crane, Concrete Mixer, Generator):
  * **Worked Hours**: Productive runtime (used for EVM calculation/efficiency metrics).
  * **Idle Hours**: Ineffective runtime due to logistics delay, breakdowns, or weather.

#### Step 7: Form Validation & Submit Preview
* Summary card displays total metrics recorded: Total BOQ activities logged, Selected executing actor, Materials utilized, Machinery hours.
* Intercepts validations (e.g., warns if no manpower was filed, blocks submit if remarks are empty during bad weather).
* Launches final confirmation prompting full write-back to database.

### C. Technical Trade Reference Guides
* Direct interface providing offline-first specifications for concrete testing, rebar alignments, brickwork tolerances, safety protocols, and quality standards.
* Simple search filter lets site engineers double-check reference guidelines under harsh conditions.

### D. Warehouse Inventory & Storekeeping Panel
* Dual toggles: **Material Receipt (GRN)** or **Material Issue (MTR)**.
* **Header details**: Invoice/MTR reference code, supplier, tracking id, receiver profile.
* **Dynamic itemizer rows**: Operators can dynamically append itemizer rows utilizing an elegant picker modal. Captures material name, units, and quantity records.

### E. Alert & Project Bottleneck Flagging
* **Classifications**: `Severe Weather Delay`, `Material Shortage`, `Machinery Breakdown`, `Design Conflict (Drawing Missing)`, `Safeties Hazard`.
* **Severe Tiers**: `Moderate` (Yellow visual), `High` (Orange alert), `Critical / Project Stopper` (Red flash pulsing indicator).
* Automatically raises immediate task logs on the Office dashboard and pushes notifications to project superintendent.

### F. Historical Report Ledger & Detail Vault
* Historical lists with integrated search/date filters.
* Deep details drawer allowing encoders to inspect comprehensive resource allocations of historical dates, modify historical entries (if roles allow), and print/share formatted records.

---

## 4. Supabase DB Schema & Key Model Relationships

To ensure flawless native Android data management and web parity, the database schema integrates directly with Supabase Postgres. Standard queries leverage SQL joins with active relation scoping to filter out irrelevant tenant files.

```
       ┌────────────────────────┐
       │   projects             │
       └────────────────────────┘
                    │ 1
                    ├───────────────────────────────┐
                    │ 1..*                          │ 1..*
       ┌────────────────────────┐      ┌────────────────────────┐
       │   daily_progress       │      │   boq_items            │
       └────────────────────────┘      └────────────────────────┘
                    │ 1                             │ 1
                    ├──────────────────────┐        │
                    │ 1..*                 │ 1..*   │ 1..*
       ┌────────────────────────┐      ┌────────────────────────┐
       │   daily_activities     │ ───> │   daily_materials      │
       └────────────────────────┘      └────────────────────────┘
```

### Table 1: `daily_progress` (Aggregate site report master log)
* `id`: `UUID` (Primary Key)
* `project_id`: `UUID` (Foreign Key -> `projects.id`)
* `submitted_by`: `UUID` (Foreign Key -> `auth.users.id`)
* `report_date`: `DATE`
* `status`: `TEXT` (`'draft'`, `'submitted'`, `'reviewed'`)
* `weather`: `TEXT` (`'sunny'`, `'rainy'`, `'cold'`, `'humid'`)
* `remarks`: `TEXT`
* `shift_type`: `TEXT` (`'day'`, `'night'`, `'double'`)
* `actual_total_cost`: `NUMERIC(14,2)` (Computed aggregate daily cost)
* `tenant_id`: `UUID` (Sizing bounds check)
* `created_at`: `TIMESTAMP`

### Table 2: `daily_activities` (Work items recorded progress)
* `id`: `UUID` (Primary Key)
* `daily_progress_id`: `UUID` (Foreign Key -> `daily_progress.id` ON DELETE CASCADE)
* `boq_item_id`: `UUID` (Foreign Key -> `boq_items.id`)
* `progress_qty`: `NUMERIC(12,2)`
* `remarks`: `TEXT`
* `subcontractor_id`: `UUID` (Optional reference to active sub contract)
* `labour_grade_id`: `TEXT` (Optional reference to Daily Basis crew type)

### Table 3: `daily_labour` (Deployed crews runtime tracking)
* `id`: `UUID` (Primary Key)
* `daily_progress_id`: `UUID` (Foreign Key -> `daily_progress.id` ON DELETE CASCADE)
* `labour_grade_id`: `TEXT` (Category code from dynamic library)
* `headcount`: `INTEGER`
* `hours_worked`: `NUMERIC(4,2)`

### Table 4: `daily_materials` (Material logs or store movements)
* `id`: `UUID` (Primary Key)
* `daily_progress_id`: `UUID` (Foreign Key -> `daily_progress.id` ON DELETE CASCADE)
* `material_id`: `TEXT` (Material Inventory Identifier)
* `quantity_used`: `NUMERIC(12,2)`
* `movement_type`: `TEXT` (`'grn_receipt'`, `'usage'`, `'stock_issue'`)

### Table 5: `daily_equipment` (Machinery execution efficiency tracking)
* `id`: `UUID` (Primary Key)
* `daily_progress_id`: `UUID` (Foreign Key -> `daily_progress.id` ON DELETE CASCADE)
* `equipment_id`: `TEXT` (Machinery Library Code)
* `hours_worked`: `NUMERIC(4,2)`
* `idle_hours`: `NUMERIC(4,2)`

---

## 4.5. Backend Integration & Data Workflows

### A. Operations Logging & Scope Filtering
* Real-time queries use relational filters. For example, to load active activities of an existing project:
  ```ts
  supabase
    .from('daily_activities')
    .select(`
      *,
      daily_progress!inner (report_date, status, project_id),
      boq_items (item_no, description, unit)
    `)
    .eq('daily_progress.project_id', projectId)
  ```
* Write transactions wrap operations inside standard transactions (using upsert/insert promises) to prevent orphan rows if connection cuts out.

### B. UI Clutter Prevention Rules (Data Suppression)
* **Conditional Visibility**: Empty metrics are treated with high semantic discretion. If `contract_qty` is `0` or null, it represents a group category container. In this scenario, the app completely omits the numerical `0` metric to keep columns empty and clean.
* **Smart Auto-Summations**: Parent summary rows automatically aggregate child progress values dynamically. Redundant visual noise (e.g., repeating static locked symbols, unnecessary default double-zeros, etc.) is scrubbed out. These blocks remain unrendered if values are uninitiated or non-operative.

---

## 5. UI Style Palette & Tailwind to Kotlin Compose Mapping

The Site App matches the core web application’s elite dark canvas typography and high-density interface.

| Design Attribute | Tailwind CSS Classes | Jetpack Compose Equivalent |
| :--- | :--- | :--- |
| **Main Background** | `bg-surface-base` (deep off-black) | `MaterialTheme.colorScheme.background` (`Color(0xFF0F1115)`) |
| **Card / Dialog Panel** | `bg-surface-1` (slate charcoal) | `Surface` containing code `Color(0xFF16191F)` |
| **Accent Primary Color** | `bg-primary` / `text-primary` | `Color(0xFF0284C7)` (Industrial Slate Blue) |
| **Safe Success State** | `text-emerald-500` | `Color(0xFF10B981)` |
| **Hazard State** | `text-orange-500` / `bg-danger` | `Color(0xFFEF4444)` (Deep Alarm Red) |
| **Body Typography** | `font-sans text-sm text-main` | `Typography.bodyMedium` paired with `Inter` Font Family |
| **Mono Details** | `font-mono text-[10px]` | `Typography.labelSmall` paired with `JetBrains Mono` Font |

---

## 6. Jetpack Compose Template: Native Implementation Roadmap

For the native Android application development, map `SiteApp.tsx` directly to the following structure:

### A. View Model State Holder (`SiteAppViewModel.kt`)
```kotlin
data class SiteAppUiState(
    val selectedTab: String = "dashboard",
    val activeRole: String = "site_encoder",
    val currentStep: Int = 1,
    val selectedWeather: String = "sunny",
    val remarks: String = "",
    val activitiesList: List<BoqItemProgress> = emptyList(),
    val manpowerEntries: List<LabourLog> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

class SiteAppViewModel(
    private val siteRepository: SiteRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(SiteAppUiState())
    val uiState: StateFlow<SiteAppUiState> = _uiState.asStateFlow()

    fun updateWeather(weather: String) {
        _uiState.update { it.copy(selectedWeather = weather) }
    }

    fun nextStep() {
        if (_uiState.value.currentStep < 7) {
            _uiState.update { it.copy(currentStep = it.currentStep + 1) }
        }
    }
    
    fun submitDailyLog() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                siteRepository.uploadLog(_uiState.value)
                _uiState.update { it.copy(isLoading = false, currentStep = 1, selectedTab = "dashboard") }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.localizedMessage) }
            }
        }
    }
}
```

### B. Scaffold Jetpack Compose Layout Shell (`SiteAppActivity.kt`)
```kotlin
@Composable
fun SiteAppScreen(viewModel: SiteAppViewModel) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        bottomBar = {
            SiteAppNavigationFooter(
                activeTab = state.selectedTab,
                onTabSelected = { viewModel.updateSelectedTab(it) }
            )
        },
        backgroundColor = Color(0xFF0F1115)
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            when (state.selectedTab) {
                "dashboard" -> DashboardView(state, viewModel)
                "report" -> ReportWizardView(state, viewModel)
                "trade_guide" -> TradeGuideView()
                "store" -> StoreView(state, viewModel)
                "alerts" -> AlertsView(state, viewModel)
            }
        }
    }
}
```

---

## 7. Key Technical Integration Points

### 1. Offline-First Capability (CRITICAL FOR FIELD SITE WORK)
The native Android app must build a standard SQL room cache:
* **Storage strategy**: All wizard transactions, resource list components, and BOQ tables must be accessed locally first.
* **Sync sync queue worker**: Leverage Android **WorkManager** to trigger persistent background synchronization tasks (`SiteDataSyncWorker`) as soon as network strength indicates acceptable latency.

### 2. Location Tracking Check-ins
* **Location validations**: Daily progress report submissions require verification within the defined project location boundary geofence. Use Google Play services location APIs (`FusedLocationProviderClient`) to securely fetch GPS coordinates before enabling report submission.

### 3. Attachment Media Compression
* **Camera interactions**: Site inspectors routinely attach progress images of installed works. Use Android CameraX APIs to snap images and apply automatic client-side scaling (maximum image height `1080px`, JPEG quality rating of `80`) to compress uploads before sync, preserving bandwidth of remote cellular towers.
