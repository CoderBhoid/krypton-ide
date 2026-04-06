// Centralized language snippet registry for Krypton IDE
// Organized by language, provides autocomplete suggestions in Monaco

export interface CodeSnippet {
  prefix: string;
  body: string;
  description: string;
  language: string;
}

// ─── Java (Android) Snippets ─────────────────────────────────
const javaSnippets: CodeSnippet[] = [
  { prefix: 'main', body: 'public static void main(String[] args) {\n    $0\n}', description: 'Main method', language: 'java' },
  { prefix: 'sout', body: 'System.out.println($0);', description: 'Print to stdout', language: 'java' },
  { prefix: 'serr', body: 'System.err.println($0);', description: 'Print to stderr', language: 'java' },
  { prefix: 'psvm', body: 'public static void main(String[] args) {\n    $0\n}', description: 'Public static void main', language: 'java' },
  { prefix: 'fori', body: 'for (int i = 0; i < $1; i++) {\n    $0\n}', description: 'For loop with index', language: 'java' },
  { prefix: 'foreach', body: 'for ($1 item : $2) {\n    $0\n}', description: 'Enhanced for loop', language: 'java' },
  { prefix: 'if', body: 'if ($1) {\n    $0\n}', description: 'If statement', language: 'java' },
  { prefix: 'ifelse', body: 'if ($1) {\n    $2\n} else {\n    $0\n}', description: 'If-else statement', language: 'java' },
  { prefix: 'try', body: 'try {\n    $0\n} catch (Exception e) {\n    e.printStackTrace();\n}', description: 'Try-catch block', language: 'java' },
  { prefix: 'trycf', body: 'try {\n    $0\n} catch (Exception e) {\n    e.printStackTrace();\n} finally {\n    \n}', description: 'Try-catch-finally', language: 'java' },
  { prefix: 'class', body: 'public class $1 {\n    $0\n}', description: 'Class declaration', language: 'java' },
  { prefix: 'interface', body: 'public interface $1 {\n    $0\n}', description: 'Interface declaration', language: 'java' },
  { prefix: 'enum', body: 'public enum $1 {\n    $0\n}', description: 'Enum declaration', language: 'java' },
  { prefix: 'method', body: 'public $1 $2($3) {\n    $0\n}', description: 'Method declaration', language: 'java' },
  { prefix: 'ctor', body: 'public $1($2) {\n    $0\n}', description: 'Constructor', language: 'java' },
  { prefix: 'singleton', body: 'private static $1 instance;\n\nprivate $1() {}\n\npublic static $1 getInstance() {\n    if (instance == null) {\n        instance = new $1();\n    }\n    return instance;\n}', description: 'Singleton pattern', language: 'java' },
  // Android-specific
  { prefix: 'activity', body: 'public class $1 extends AppCompatActivity {\n    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        setContentView(R.layout.$2);\n        $0\n    }\n}', description: 'Android Activity', language: 'java' },
  { prefix: 'fragment', body: 'public class $1 extends Fragment {\n    @Override\n    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {\n        return inflater.inflate(R.layout.$2, container, false);\n    }\n}', description: 'Android Fragment', language: 'java' },
  { prefix: 'onclick', body: '$1.setOnClickListener(v -> {\n    $0\n});', description: 'OnClickListener', language: 'java' },
  { prefix: 'toast', body: 'Toast.makeText(this, "$1", Toast.LENGTH_SHORT).show();', description: 'Android Toast', language: 'java' },
  { prefix: 'intent', body: 'Intent intent = new Intent(this, $1.class);\nstartActivity(intent);', description: 'Start Activity Intent', language: 'java' },
  { prefix: 'recycler', body: 'public class $1Adapter extends RecyclerView.Adapter<$1Adapter.ViewHolder> {\n    private List<$2> items;\n\n    public $1Adapter(List<$2> items) {\n        this.items = items;\n    }\n\n    @Override\n    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {\n        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.$3, parent, false);\n        return new ViewHolder(view);\n    }\n\n    @Override\n    public void onBindViewHolder(ViewHolder holder, int position) {\n        $2 item = items.get(position);\n        $0\n    }\n\n    @Override\n    public int getItemCount() {\n        return items.size();\n    }\n\n    static class ViewHolder extends RecyclerView.ViewHolder {\n        ViewHolder(View itemView) {\n            super(itemView);\n        }\n    }\n}', description: 'RecyclerView Adapter', language: 'java' },
  { prefix: 'viewmodel', body: 'public class $1ViewModel extends ViewModel {\n    private MutableLiveData<$2> _data = new MutableLiveData<>();\n    public LiveData<$2> data = _data;\n\n    public void load$2() {\n        $0\n    }\n}', description: 'Android ViewModel', language: 'java' },
  { prefix: 'log', body: 'Log.d("$1", "$2");', description: 'Android Log.d', language: 'java' },
  { prefix: 'findview', body: '$1 $2 = findViewById(R.id.$3);', description: 'findViewById', language: 'java' },
  { prefix: 'asynctask', body: 'new Thread(() -> {\n    $0\n    runOnUiThread(() -> {\n        // Update UI\n    });\n}).start();', description: 'Background thread + UI update', language: 'java' },
  { prefix: 'sharedpref', body: 'SharedPreferences prefs = getSharedPreferences("$1", MODE_PRIVATE);\nSharedPreferences.Editor editor = prefs.edit();\neditor.putString("$2", $3);\neditor.apply();', description: 'SharedPreferences', language: 'java' },
];

// ─── Kotlin (Android) Snippets ───────────────────────────────
const kotlinSnippets: CodeSnippet[] = [
  { prefix: 'main', body: 'fun main() {\n    $0\n}', description: 'Main function', language: 'kotlin' },
  { prefix: 'println', body: 'println($0)', description: 'Print line', language: 'kotlin' },
  { prefix: 'fun', body: 'fun $1($2): $3 {\n    $0\n}', description: 'Function', language: 'kotlin' },
  { prefix: 'class', body: 'class $1($2) {\n    $0\n}', description: 'Class', language: 'kotlin' },
  { prefix: 'dclass', body: 'data class $1(\n    val $2: $3,\n    $0\n)', description: 'Data class', language: 'kotlin' },
  { prefix: 'object', body: 'object $1 {\n    $0\n}', description: 'Object declaration', language: 'kotlin' },
  { prefix: 'interface', body: 'interface $1 {\n    $0\n}', description: 'Interface', language: 'kotlin' },
  { prefix: 'sealed', body: 'sealed class $1 {\n    $0\n}', description: 'Sealed class', language: 'kotlin' },
  { prefix: 'enum', body: 'enum class $1 {\n    $0\n}', description: 'Enum class', language: 'kotlin' },
  { prefix: 'when', body: 'when ($1) {\n    $2 -> $3\n    else -> $0\n}', description: 'When expression', language: 'kotlin' },
  { prefix: 'if', body: 'if ($1) {\n    $0\n}', description: 'If statement', language: 'kotlin' },
  { prefix: 'ifelse', body: 'if ($1) {\n    $2\n} else {\n    $0\n}', description: 'If-else', language: 'kotlin' },
  { prefix: 'try', body: 'try {\n    $0\n} catch (e: Exception) {\n    e.printStackTrace()\n}', description: 'Try-catch', language: 'kotlin' },
  { prefix: 'for', body: 'for ($1 in $2) {\n    $0\n}', description: 'For loop', language: 'kotlin' },
  { prefix: 'fori', body: 'for (i in 0 until $1) {\n    $0\n}', description: 'For loop with index', language: 'kotlin' },
  { prefix: 'lambda', body: '{ $1 -> $0 }', description: 'Lambda expression', language: 'kotlin' },
  { prefix: 'coroutine', body: 'lifecycleScope.launch {\n    $0\n}', description: 'Coroutine launch', language: 'kotlin' },
  { prefix: 'suspend', body: 'suspend fun $1($2): $3 {\n    $0\n}', description: 'Suspend function', language: 'kotlin' },
  { prefix: 'flow', body: 'flow {\n    emit($0)\n}', description: 'Kotlin Flow', language: 'kotlin' },
  { prefix: 'lazy', body: 'val $1 by lazy {\n    $0\n}', description: 'Lazy property', language: 'kotlin' },
  { prefix: 'companion', body: 'companion object {\n    $0\n}', description: 'Companion object', language: 'kotlin' },
  { prefix: 'ext', body: 'fun $1.$2($3): $4 {\n    $0\n}', description: 'Extension function', language: 'kotlin' },
  // Android Kotlin
  { prefix: 'activity', body: 'class $1 : AppCompatActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        setContentView(R.layout.$2)\n        $0\n    }\n}', description: 'Kotlin Activity', language: 'kotlin' },
  { prefix: 'fragment', body: 'class $1 : Fragment() {\n    override fun onCreateView(\n        inflater: LayoutInflater,\n        container: ViewGroup?,\n        savedInstanceState: Bundle?\n    ): View? {\n        return inflater.inflate(R.layout.$2, container, false)\n    }\n}', description: 'Kotlin Fragment', language: 'kotlin' },
  { prefix: 'viewmodel', body: 'class $1ViewModel : ViewModel() {\n    private val _state = MutableStateFlow($2())\n    val state: StateFlow<$2> = _state.asStateFlow()\n\n    fun $3() {\n        viewModelScope.launch {\n            $0\n        }\n    }\n}', description: 'ViewModel with StateFlow', language: 'kotlin' },
  { prefix: 'composable', body: '@Composable\nfun $1($2) {\n    $0\n}', description: 'Composable function', language: 'kotlin' },
  { prefix: 'column', body: 'Column(\n    modifier = Modifier.fillMaxSize(),\n    verticalArrangement = Arrangement.Center,\n    horizontalAlignment = Alignment.CenterHorizontally\n) {\n    $0\n}', description: 'Compose Column', language: 'kotlin' },
  { prefix: 'row', body: 'Row(\n    modifier = Modifier.fillMaxWidth(),\n    horizontalArrangement = Arrangement.SpaceBetween,\n    verticalAlignment = Alignment.CenterVertically\n) {\n    $0\n}', description: 'Compose Row', language: 'kotlin' },
  { prefix: 'lazycolumn', body: 'LazyColumn {\n    items($1) { item ->\n        $0\n    }\n}', description: 'Compose LazyColumn', language: 'kotlin' },
  { prefix: 'text', body: 'Text(\n    text = "$1",\n    style = MaterialTheme.typography.$2\n)', description: 'Compose Text', language: 'kotlin' },
  { prefix: 'button', body: 'Button(onClick = { $1 }) {\n    Text("$0")\n}', description: 'Compose Button', language: 'kotlin' },
  { prefix: 'toast', body: 'Toast.makeText(this, "$1", Toast.LENGTH_SHORT).show()', description: 'Toast', language: 'kotlin' },
  { prefix: 'intent', body: 'startActivity(Intent(this, $1::class.java))', description: 'Start Activity', language: 'kotlin' },
  { prefix: 'log', body: 'Log.d("$1", "$2")', description: 'Log.d', language: 'kotlin' },
  { prefix: 'recyclerview', body: 'class $1Adapter(private val items: List<$2>) : RecyclerView.Adapter<$1Adapter.ViewHolder>() {\n    class ViewHolder(view: View) : RecyclerView.ViewHolder(view)\n\n    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {\n        val view = LayoutInflater.from(parent.context).inflate(R.layout.$3, parent, false)\n        return ViewHolder(view)\n    }\n\n    override fun onBindViewHolder(holder: ViewHolder, position: Int) {\n        val item = items[position]\n        $0\n    }\n\n    override fun getItemCount() = items.size\n}', description: 'RecyclerView Adapter', language: 'kotlin' },
];

// ─── Rust Snippets ───────────────────────────────────────────
const rustSnippets: CodeSnippet[] = [
  { prefix: 'main', body: 'fn main() {\n    $0\n}', description: 'Main function', language: 'rust' },
  { prefix: 'println', body: 'println!("$0");', description: 'Print with newline', language: 'rust' },
  { prefix: 'fn', body: 'fn $1($2) -> $3 {\n    $0\n}', description: 'Function', language: 'rust' },
  { prefix: 'pfn', body: 'pub fn $1($2) -> $3 {\n    $0\n}', description: 'Public function', language: 'rust' },
  { prefix: 'struct', body: 'struct $1 {\n    $0\n}', description: 'Struct', language: 'rust' },
  { prefix: 'pstruct', body: 'pub struct $1 {\n    pub $0\n}', description: 'Public struct', language: 'rust' },
  { prefix: 'impl', body: 'impl $1 {\n    $0\n}', description: 'Implementation block', language: 'rust' },
  { prefix: 'implnew', body: 'impl $1 {\n    pub fn new($2) -> Self {\n        Self {\n            $0\n        }\n    }\n}', description: 'Impl with new()', language: 'rust' },
  { prefix: 'trait', body: 'trait $1 {\n    $0\n}', description: 'Trait', language: 'rust' },
  { prefix: 'enum', body: 'enum $1 {\n    $0\n}', description: 'Enum', language: 'rust' },
  { prefix: 'match', body: 'match $1 {\n    $2 => $3,\n    _ => $0,\n}', description: 'Match expression', language: 'rust' },
  { prefix: 'if', body: 'if $1 {\n    $0\n}', description: 'If statement', language: 'rust' },
  { prefix: 'iflet', body: 'if let Some($1) = $2 {\n    $0\n}', description: 'If let Some', language: 'rust' },
  { prefix: 'for', body: 'for $1 in $2 {\n    $0\n}', description: 'For loop', language: 'rust' },
  { prefix: 'loop', body: 'loop {\n    $0\n}', description: 'Infinite loop', language: 'rust' },
  { prefix: 'while', body: 'while $1 {\n    $0\n}', description: 'While loop', language: 'rust' },
  { prefix: 'vec', body: 'let $1: Vec<$2> = Vec::new();', description: 'New Vec', language: 'rust' },
  { prefix: 'vecm', body: 'let $1 = vec![$0];', description: 'Vec macro', language: 'rust' },
  { prefix: 'hashmap', body: 'let mut $1: HashMap<$2, $3> = HashMap::new();', description: 'HashMap', language: 'rust' },
  { prefix: 'result', body: 'Result<$1, $2>', description: 'Result type', language: 'rust' },
  { prefix: 'option', body: 'Option<$1>', description: 'Option type', language: 'rust' },
  { prefix: 'test', body: '#[test]\nfn $1() {\n    $0\n}', description: 'Unit test', language: 'rust' },
  { prefix: 'testmod', body: '#[cfg(test)]\nmod tests {\n    use super::*;\n\n    #[test]\n    fn $1() {\n        $0\n    }\n}', description: 'Test module', language: 'rust' },
  { prefix: 'derive', body: '#[derive($0)]', description: 'Derive macro', language: 'rust' },
  { prefix: 'use', body: 'use $0;', description: 'Use statement', language: 'rust' },
  { prefix: 'mod', body: 'mod $1;', description: 'Module declaration', language: 'rust' },
  { prefix: 'async', body: 'async fn $1($2) -> $3 {\n    $0\n}', description: 'Async function', language: 'rust' },
  { prefix: 'closure', body: '|$1| {\n    $0\n}', description: 'Closure', language: 'rust' },
  { prefix: 'unwrap', body: '.unwrap_or_else(|e| {\n    eprintln!("Error: {}", e);\n    $0\n})', description: 'Unwrap with error handling', language: 'rust' },
];

// ─── Gradle DSL Snippets ─────────────────────────────────────
const gradleSnippets: CodeSnippet[] = [
  { prefix: 'android', body: 'android {\n    compileSdk $1\n\n    defaultConfig {\n        applicationId "$2"\n        minSdk $3\n        targetSdk $4\n        versionCode $5\n        versionName "$6"\n    }\n    $0\n}', description: 'Android block', language: 'groovy' },
  { prefix: 'dependencies', body: 'dependencies {\n    implementation "$0"\n}', description: 'Dependencies block', language: 'groovy' },
  { prefix: 'impl', body: "implementation '$0'", description: 'Implementation dependency', language: 'groovy' },
  { prefix: 'testimpl', body: "testImplementation '$0'", description: 'Test implementation', language: 'groovy' },
  { prefix: 'androidtestimpl', body: "androidTestImplementation '$0'", description: 'Android test implementation', language: 'groovy' },
  { prefix: 'plugins', body: 'plugins {\n    id \'$0\'\n}', description: 'Plugins block', language: 'groovy' },
  { prefix: 'buildtypes', body: 'buildTypes {\n    release {\n        minifyEnabled true\n        proguardFiles getDefaultProguardFile(\'proguard-android-optimize.txt\'), \'proguard-rules.pro\'\n    }\n}', description: 'Build types', language: 'groovy' },
  { prefix: 'signingconfigs', body: 'signingConfigs {\n    release {\n        storeFile file("$1")\n        storePassword "$2"\n        keyAlias "$3"\n        keyPassword "$4"\n    }\n}', description: 'Signing configs', language: 'groovy' },
  { prefix: 'compileOptions', body: 'compileOptions {\n    sourceCompatibility JavaVersion.VERSION_17\n    targetCompatibility JavaVersion.VERSION_17\n}', description: 'Java compile options', language: 'groovy' },
  { prefix: 'kotlinOptions', body: 'kotlinOptions {\n    jvmTarget = "17"\n}', description: 'Kotlin options', language: 'groovy' },
  { prefix: 'compose', body: 'buildFeatures {\n    compose true\n}\ncomposeOptions {\n    kotlinCompilerExtensionVersion "$0"\n}', description: 'Enable Jetpack Compose', language: 'groovy' },
  { prefix: 'viewbinding', body: 'buildFeatures {\n    viewBinding true\n}', description: 'Enable ViewBinding', language: 'groovy' },
  { prefix: 'room', body: "implementation 'androidx.room:room-runtime:$1'\nkapt 'androidx.room:room-compiler:$1'\nimplementation 'androidx.room:room-ktx:$1'", description: 'Room dependencies', language: 'groovy' },
  { prefix: 'retrofit', body: "implementation 'com.squareup.retrofit2:retrofit:$1'\nimplementation 'com.squareup.retrofit2:converter-gson:$1'", description: 'Retrofit dependencies', language: 'groovy' },
  { prefix: 'coroutines', body: "implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:$1'\nimplementation 'org.jetbrains.kotlinx:kotlinx-coroutines-core:$1'", description: 'Kotlin Coroutines', language: 'groovy' },
];

// ─── Go Snippets ─────────────────────────────────────────────
const goSnippets: CodeSnippet[] = [
  { prefix: 'main', body: 'package main\n\nimport "fmt"\n\nfunc main() {\n    $0\n}', description: 'Main package', language: 'go' },
  { prefix: 'func', body: 'func $1($2) $3 {\n    $0\n}', description: 'Function', language: 'go' },
  { prefix: 'struct', body: 'type $1 struct {\n    $0\n}', description: 'Struct', language: 'go' },
  { prefix: 'interface', body: 'type $1 interface {\n    $0\n}', description: 'Interface', language: 'go' },
  { prefix: 'iferr', body: 'if err != nil {\n    return $0\n}', description: 'Error check', language: 'go' },
  { prefix: 'for', body: 'for $1 := range $2 {\n    $0\n}', description: 'For range loop', language: 'go' },
  { prefix: 'fori', body: 'for i := 0; i < $1; i++ {\n    $0\n}', description: 'For loop with index', language: 'go' },
  { prefix: 'goroutine', body: 'go func() {\n    $0\n}()', description: 'Goroutine', language: 'go' },
  { prefix: 'channel', body: '$1 := make(chan $2)', description: 'Channel', language: 'go' },
  { prefix: 'test', body: 'func Test$1(t *testing.T) {\n    $0\n}', description: 'Test function', language: 'go' },
];

// ─── C/C++ Snippets ──────────────────────────────────────────
const cppSnippets: CodeSnippet[] = [
  { prefix: 'main', body: '#include <iostream>\n\nint main() {\n    $0\n    return 0;\n}', description: 'Main function', language: 'cpp' },
  { prefix: 'cout', body: 'std::cout << $0 << std::endl;', description: 'Console output', language: 'cpp' },
  { prefix: 'cin', body: 'std::cin >> $0;', description: 'Console input', language: 'cpp' },
  { prefix: 'class', body: 'class $1 {\npublic:\n    $1();\n    ~$1();\nprivate:\n    $0\n};', description: 'Class declaration', language: 'cpp' },
  { prefix: 'for', body: 'for (int i = 0; i < $1; i++) {\n    $0\n}', description: 'For loop', language: 'cpp' },
  { prefix: 'foreach', body: 'for (auto& $1 : $2) {\n    $0\n}', description: 'Range-based for', language: 'cpp' },
  { prefix: 'vector', body: 'std::vector<$1> $2;', description: 'Vector', language: 'cpp' },
  { prefix: 'map', body: 'std::map<$1, $2> $3;', description: 'Map', language: 'cpp' },
  { prefix: 'unique_ptr', body: 'std::unique_ptr<$1> $2 = std::make_unique<$1>($0);', description: 'Unique pointer', language: 'cpp' },
  { prefix: 'shared_ptr', body: 'std::shared_ptr<$1> $2 = std::make_shared<$1>($0);', description: 'Shared pointer', language: 'cpp' },
];

// ─── Python Snippets ─────────────────────────────────────────
const pythonSnippets: CodeSnippet[] = [
  { prefix: 'main', body: 'def main():\n    $0\n\nif __name__ == "__main__":\n    main()', description: 'Main entry point', language: 'python' },
  { prefix: 'def', body: 'def $1($2):\n    $0', description: 'Function', language: 'python' },
  { prefix: 'class', body: 'class $1:\n    def __init__(self$2):\n        $0', description: 'Class', language: 'python' },
  { prefix: 'for', body: 'for $1 in $2:\n    $0', description: 'For loop', language: 'python' },
  { prefix: 'if', body: 'if $1:\n    $0', description: 'If statement', language: 'python' },
  { prefix: 'try', body: 'try:\n    $0\nexcept Exception as e:\n    print(e)', description: 'Try-except', language: 'python' },
  { prefix: 'with', body: 'with open("$1", "$2") as f:\n    $0', description: 'File context manager', language: 'python' },
  { prefix: 'lambda', body: 'lambda $1: $0', description: 'Lambda expression', language: 'python' },
  { prefix: 'list_comp', body: '[$1 for $2 in $3]', description: 'List comprehension', language: 'python' },
  { prefix: 'dict_comp', body: '{$1: $2 for $3 in $4}', description: 'Dict comprehension', language: 'python' },
  { prefix: 'dataclass', body: 'from dataclasses import dataclass\n\n@dataclass\nclass $1:\n    $0', description: 'Dataclass', language: 'python' },
  { prefix: 'async', body: 'async def $1($2):\n    $0', description: 'Async function', language: 'python' },
];

// ─── TypeScript/JavaScript Snippets ──────────────────────────
const tsSnippets: CodeSnippet[] = [
  { prefix: 'func', body: 'function $1($2) {\n  $0\n}', description: 'Function', language: 'typescript' },
  { prefix: 'afunc', body: 'async function $1($2) {\n  $0\n}', description: 'Async function', language: 'typescript' },
  { prefix: 'arrow', body: 'const $1 = ($2) => {\n  $0\n};', description: 'Arrow function', language: 'typescript' },
  { prefix: 'aarrow', body: 'const $1 = async ($2) => {\n  $0\n};', description: 'Async arrow function', language: 'typescript' },
  { prefix: 'interface', body: 'interface $1 {\n  $0\n}', description: 'Interface', language: 'typescript' },
  { prefix: 'type', body: 'type $1 = {\n  $0\n};', description: 'Type alias', language: 'typescript' },
  { prefix: 'enum', body: 'enum $1 {\n  $0\n}', description: 'Enum', language: 'typescript' },
  { prefix: 'class', body: 'class $1 {\n  constructor($2) {\n    $0\n  }\n}', description: 'Class', language: 'typescript' },
  { prefix: 'try', body: 'try {\n  $0\n} catch (err) {\n  console.error(err);\n}', description: 'Try-catch', language: 'typescript' },
  { prefix: 'fetch', body: "const res = await fetch('$1');\nconst data = await res.json();\n$0", description: 'Fetch API', language: 'typescript' },
  { prefix: 'promise', body: 'new Promise((resolve, reject) => {\n  $0\n});', description: 'Promise', language: 'typescript' },
  { prefix: 'map', body: '$1.map(($2) => {\n  $0\n});', description: 'Array map', language: 'typescript' },
  { prefix: 'filter', body: '$1.filter(($2) => $0);', description: 'Array filter', language: 'typescript' },
  { prefix: 'reduce', body: '$1.reduce((acc, $2) => {\n  $0\n  return acc;\n}, $3);', description: 'Array reduce', language: 'typescript' },
  // React snippets
  { prefix: 'rfc', body: "export function $1() {\n  return (\n    <div>\n      $0\n    </div>\n  );\n}", description: 'React Function Component', language: 'typescript' },
  { prefix: 'useState', body: 'const [$1, set$2] = useState($3);', description: 'React useState', language: 'typescript' },
  { prefix: 'useEffect', body: 'useEffect(() => {\n  $0\n}, [$1]);', description: 'React useEffect', language: 'typescript' },
  { prefix: 'useMemo', body: 'const $1 = useMemo(() => {\n  return $0;\n}, [$2]);', description: 'React useMemo', language: 'typescript' },
];

// ─── All Snippets Registry ───────────────────────────────────
const ALL_SNIPPETS: CodeSnippet[] = [
  ...javaSnippets,
  ...kotlinSnippets,
  ...rustSnippets,
  ...gradleSnippets,
  ...goSnippets,
  ...cppSnippets,
  ...pythonSnippets,
  ...tsSnippets,
];

export function getSnippetsForLanguage(language: string): CodeSnippet[] {
  // Normalize language name
  const normalized = language.toLowerCase();
  const langMap: Record<string, string> = {
    'javascript': 'typescript',
    'javascriptreact': 'typescript',
    'typescriptreact': 'typescript',
    'groovy': 'groovy',
    'c': 'cpp',
  };
  const targetLang = langMap[normalized] || normalized;
  return ALL_SNIPPETS.filter(s => s.language === targetLang);
}

export function getAllSnippets(): CodeSnippet[] {
  return ALL_SNIPPETS;
}

export function getSnippetLanguages(): string[] {
  return [...new Set(ALL_SNIPPETS.map(s => s.language))];
}
