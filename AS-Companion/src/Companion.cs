using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: AssemblyTitle("AS Companion")]
[assembly: AssemblyProduct("AS Companion")]
[assembly: AssemblyDescription("Build planner and launcher for Azeroth Survivors")]
[assembly: AssemblyCompany("ZKYXYKZ")]
[assembly: AssemblyCopyright("ZKYXYKZ")]

static class Web2
{
    static string libDir;

    public static void Prepare()
    {
        string version = Assembly.GetExecutingAssembly().GetName().Version.ToString();
        libDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AS-Companion", "lib", version);
        try
        {
            Directory.CreateDirectory(libDir);
            string arch = (Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE") ?? "").ToUpperInvariant() == "ARM64" ? "arm64" : Environment.Is64BitProcess ? "x64" : "x86";
            Extract("lib/Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.Core.dll");
            Extract("lib/Microsoft.Web.WebView2.WinForms.dll", "Microsoft.Web.WebView2.WinForms.dll");
            Extract("lib/" + arch + "/WebView2Loader.dll", "WebView2Loader.dll");
        }
        catch { }
        AppDomain.CurrentDomain.AssemblyResolve += (s, e) =>
        {
            string f = Path.Combine(libDir, new AssemblyName(e.Name).Name + ".dll");
            return File.Exists(f) ? Assembly.LoadFrom(f) : null;
        };
    }

    static void Extract(string resource, string name)
    {
        string target = Path.Combine(libDir, name);
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
        {
            if (s == null || (File.Exists(target) && new FileInfo(target).Length == s.Length)) return;
            using (FileStream f = File.Create(target)) s.CopyTo(f);
        }
    }

    public static bool Available()
    {
        try { return Check(); } catch { return false; }
    }

    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    static bool Check()
    {
        Microsoft.Web.WebView2.Core.CoreWebView2Environment.SetLoaderDllFolderPath(libDir);
        return !string.IsNullOrEmpty(Microsoft.Web.WebView2.Core.CoreWebView2Environment.GetAvailableBrowserVersionString());
    }

    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    public static Form Create(string url, string dataDir)
    {
        return new UiWindow(url, dataDir);
    }
}

class UiWindow : Form
{
    readonly Microsoft.Web.WebView2.WinForms.WebView2 view;

    public UiWindow(string url, string dataDir)
    {
        Text = "AS Companion";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.CenterScreen;
        Rectangle wa = Screen.PrimaryScreen.WorkingArea;
        Width = Math.Min(1320, wa.Width - 40);
        Height = Math.Min(920, wa.Height - 40);
        MinimumSize = new Size(760, 520);
        BackColor = Color.FromArgb(14, 14, 16);
        view = new Microsoft.Web.WebView2.WinForms.WebView2();
        view.Dock = DockStyle.Fill;
        view.DefaultBackgroundColor = BackColor;
        Controls.Add(view);
        Load += async (s, e) =>
        {
            Microsoft.Web.WebView2.Core.CoreWebView2Environment env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(null, dataDir);
            await view.EnsureCoreWebView2Async(env);
            view.CoreWebView2.Settings.IsStatusBarEnabled = false;
            view.CoreWebView2.Settings.AreDevToolsEnabled = false;
            view.CoreWebView2.NewWindowRequested += (o, a) =>
            {
                a.Handled = true;
                if (a.Uri.StartsWith("https://")) Process.Start(a.Uri);
            };
            view.CoreWebView2.WebMessageReceived += (o, a) => OnWindowMessage(a.TryGetWebMessageAsString());
            view.Source = new Uri(url);
        };
        Resize += (s, e) => { if (view.CoreWebView2 != null) view.CoreWebView2.PostWebMessageAsString(WindowState == FormWindowState.Maximized ? "maximized" : "normal"); };
    }

    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, int m, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int value, int size);

    [StructLayout(LayoutKind.Sequential)]
    struct Rect { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    struct NcCalcSizeParams { public Rect R0, R1, R2; public IntPtr Pos; }

    void OnWindowMessage(string msg)
    {
        if (msg == "drag" || msg == "resize-top")
        {
            ReleaseCapture();
            SendMessage(Handle, 0xA1, (IntPtr)(msg == "drag" ? 2 : 12), IntPtr.Zero);
        }
        else if (msg == "min") WindowState = FormWindowState.Minimized;
        else if (msg == "max") WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
        else if (msg == "close") Close();
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        int dark = 1, round = 2;
        DwmSetWindowAttribute(Handle, 20, ref dark, 4);
        DwmSetWindowAttribute(Handle, 33, ref round, 4);
        SetWindowPos(Handle, IntPtr.Zero, 0, 0, 0, 0, 0x0027);
    }

    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == 0x83 && m.WParam != IntPtr.Zero)
        {
            NcCalcSizeParams p = (NcCalcSizeParams)Marshal.PtrToStructure(m.LParam, typeof(NcCalcSizeParams));
            int top = p.R0.Top;
            base.WndProc(ref m);
            p = (NcCalcSizeParams)Marshal.PtrToStructure(m.LParam, typeof(NcCalcSizeParams));
            p.R0.Top = top + (WindowState == FormWindowState.Maximized ? GetSystemMetrics(33) + GetSystemMetrics(92) : 0);
            Marshal.StructureToPtr(p, m.LParam, false);
            m.Result = IntPtr.Zero;
            return;
        }
        base.WndProc(ref m);
    }
}

static class Native
{
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint c, uint t);

    public static void Press(IntPtr h, uint vk)
    {
        uint sc = MapVirtualKey(vk, 0);
        PostMessage(h, 0x100, (IntPtr)vk, (IntPtr)(1 | (sc << 16)));
        Thread.Sleep(60);
        PostMessage(h, 0x101, (IntPtr)vk, (IntPtr)(1 | (sc << 16) | (3u << 30)));
    }
}

class Overlay : Form
{
    public Label Text2;

    public Overlay()
    {
        FormBorderStyle = FormBorderStyle.None;
        TopMost = true;
        ShowInTaskbar = false;
        BackColor = Color.FromArgb(20, 20, 24);
        Opacity = 0.9;
        Width = 820;
        Height = 46;
        StartPosition = FormStartPosition.Manual;
        Rectangle scr = Screen.PrimaryScreen.Bounds;
        Left = scr.X + (scr.Width - Width) / 2;
        Top = scr.Y + 110;
        Text2 = new Label();
        Text2.Dock = DockStyle.Fill;
        Text2.TextAlign = ContentAlignment.MiddleCenter;
        Text2.ForeColor = Color.FromArgb(240, 190, 80);
        Text2.Font = new Font("Segoe UI", 15, FontStyle.Bold);
        Controls.Add(Text2);
    }

    protected override bool ShowWithoutActivation { get { return true; } }

    protected override CreateParams CreateParams
    {
        get
        {
            CreateParams cp = base.CreateParams;
            cp.ExStyle |= 0x08000000 | 0x00000080 | 0x00000008;
            return cp;
        }
    }
}

class Companion : Form
{
    static readonly int Port = TestPort();
    static int TestPort() { int p; return int.TryParse(Environment.GetEnvironmentVariable("AS_COMPANION_PORT"), out p) ? p : 47821; }
    static readonly string Url = "http://localhost:" + Port + "/";
    static readonly UTF8Encoding Utf8 = new UTF8Encoding(false);
    static readonly double[] BaseOdds = { 0.58, 0.24, 0.11, 0.05, 0.02 };

    readonly string exeDir = AppDomain.CurrentDomain.BaseDirectory;
    readonly string dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "AS-Companion");
    readonly string uiDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AS-Companion", "ui");
    string stateFile, logFile;

    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 200 };
    Dictionary<string, object> data;
    HttpListener listener;
    Overlay overlay;
    NotifyIcon tray;
    System.Windows.Forms.Timer tick;

    Process game;
    Process ui;
    bool running;
    string advice = "", error = "";
    string lang = "en";
    Dictionary<string, object> state, settings, build, heroClass;
    Dictionary<string, int> owned = new Dictionary<string, int>();
    string amulet;
    Dictionary<string, string> jewels = new Dictionary<string, string>();
    int screenRerolls;
    double runLuck, amuletLuck;
    int amuletUps;
    Dictionary<string, double> jewelLuck = new Dictionary<string, double>();
    uint pendingKey;
    DateTime pendingAt;
    int pendingTries;
    DateTime uiCheck = DateTime.Now;
    DateTime lastKey = DateTime.MinValue;

    [STAThread]
    static void Main(string[] args)
    {
        if (args.Length >= 2 && args[0] == "--replay")
        {
            Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true });
            Companion r = new Companion(args.Length > 2 ? args[2] : null);
            r.Replay(args[1]);
            return;
        }
        bool first;
        bool after = args.Contains("--after-update");
        Mutex m = new Mutex(true, "AS-Companion-ZKYXYKZ-" + Port, out first);
        for (int i = 0; !first && after && i < 50; i++)
        {
            Thread.Sleep(200);
            m.Dispose();
            m = new Mutex(true, "AS-Companion-ZKYXYKZ-" + Port, out first);
        }
        using (m)
        {
            if (!first)
            {
                try { using (WebClient w = new WebClient()) w.UploadString(Url + "api/show", ""); } catch { OpenUi(); }
                return;
            }
            Web2.Prepare();
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += (s, e) => CrashLog(e.Exception);
            AppDomain.CurrentDomain.UnhandledException += (s, e) => CrashLog(e.ExceptionObject as Exception);
            Application.EnableVisualStyles();
            Companion app;
            try
            {
                app = new Companion(args.Contains("-NoBrowser"), after);
                if (after)
                {
                    int i = Array.IndexOf(args, "--after-update");
                    app.updatedFrom = i >= 0 && i + 1 < args.Length ? args[i + 1] : "";
                    app.updatedAt = DateTime.Now;
                }
            }
            catch (Exception ex)
            {
                CrashLog(ex);
                MessageBox.Show("AS Companion: " + ex.Message, "AS Companion", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            Application.Run(app);
        }
    }

    static void CrashLog(Exception ex)
    {
        try
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "AS-Companion");
            Directory.CreateDirectory(dir);
            File.AppendAllText(Path.Combine(dir, "companion.log"), DateTime.Now.ToString("HH:mm:ss") + " error: " + ex + "\r\n");
        }
        catch { }
    }

    bool replaying;

    Companion(string replayState)
    {
        replaying = true;
        data = (Dictionary<string, object>)json.DeserializeObject(Utf8.GetString(Resource("data.json")));
        state = replayState != null ? D(json.DeserializeObject(File.ReadAllText(replayState, Utf8))) : null;
        state = state ?? new Dictionary<string, object> { { "builds", new ArrayList() }, { "active", new Dictionary<string, object>() } };
        settings = D(G(state, "settings")) ?? new Dictionary<string, object>();
        overlay = new Overlay();
    }

    void Replay(string file)
    {
        Dictionary<string, object> snapshot = null;
        Advice last = null;
        object lastChoices = null;
        int same = 0, diff = 0;
        foreach (string line in File.ReadAllLines(file, Utf8))
        {
            Dictionary<string, object> e;
            try { e = D(json.DeserializeObject(line)); } catch { continue; }
            if (e == null) continue;
            string t = S(G(e, "t"));
            object d = G(e, "data");
            if (t == "build" && D(G(d, "build")) != null && build == null) { build = D(G(d, "build")); heroClass = A(G(data, "classes")).Select(D).FirstOrDefault(c => S(c["key"]) == S(G(build, "class"))); }
            if (t == "build") { snapshot = D(G(d, "build")); Dictionary<string, object> ml = D(G(d, "measuredLuck")); if (ml != null) foreach (KeyValuePair<string, object> kv in ml) measuredLuck[kv.Key] = N(kv.Value, 0); continue; }
            if (t == "spec")
            {
                if (detectedTree < 0) DetectSpec((int)N(G(d, "tree"), 0), "replay");
                Dictionary<string, object> sb = D(G(d, "build"));
                if (sb != null) build = sb;
                continue;
            }
            if (t == "combat")
            {
                spellDmg = (D(G(d, "dmg")) ?? new Dictionary<string, object>()).ToDictionary(kv => kv.Key, kv => N(kv.Value, 0));
                totalDmg = spellDmg.Values.Sum();
                continue;
            }
            if (t == "game")
            {
                string type = S(G(d, "type"));
                if (type == "defeat" || type == "victory" || type == "coop") continue;
                if (type == "choices")
                {
                    foreach (object c in A(G(d, "choices")))
                    {
                        string rn = S(G(c, "rarityName")) ?? "";
                        if (rn == "Common" || rn == "Uncommon" || rn == "Epic" || rn == "Legendary") lang = "en";
                        if (rn == "Commun" || rn == "Inhabituel" || rn == "Épique" || rn == "Légendaire") lang = "fr";
                    }
                    lastChoices = d;
                    last = build == null ? null : Advise(D(d));
                    continue;
                }
                OnGameLine("rogue: " + json.Serialize(d));
                if (type == "ready" && snapshot != null) { build = snapshot; heroClass = heroClass ?? SelectBuild(S(G(d, "class"))); }
                continue;
            }
            if (t == "advice" && last != null)
            {
                string was = S(G(d, "text")) ?? "";
                if (last.Text == was) same++;
                else
                {
                    diff++;
                    Console.WriteLine(S(G(e, "at")) + " niv " + S(G(lastChoices, "level")) + "\n  avant : " + was + "\n  après : " + last.Text + "\n  scores : " + string.Join(" | ", lastScores));
                }
                string key = S(G(d, "key"));
                int k;
                if (key == "r") screenRerolls++;
                else if (int.TryParse(key, out k)) { object card = A(G(lastChoices, "choices")).ElementAtOrDefault(k - 1); if (card != null) Took(card); }
                last = null;
            }
        }
        Console.WriteLine(Path.GetFileName(file) + " : " + same + " identiques, " + diff + " différents" + (snapshot == null ? " (pas de build enregistré dans le fichier)" : ""));
    }

    Companion(bool noBrowser, bool afterUpdate)
    {
        try { File.Delete(Path.Combine(exeDir, "ASCompanion.old.exe")); } catch { }
        ShowInTaskbar = false;
        WindowState = FormWindowState.Minimized;
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        Opacity = 0;
        CreateHandle();
        Directory.CreateDirectory(dataDir);
        stateFile = Path.Combine(dataDir, "state.json");
        logFile = Path.Combine(dataDir, "companion.log");
        Migrate();
        data = (Dictionary<string, object>)json.DeserializeObject(Utf8.GetString(Resource("data.json")));
        overlay = new Overlay();
        tray = new NotifyIcon();
        tray.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        tray.Text = "AS Companion";
        tray.Visible = true;
        ContextMenu menu = new ContextMenu();
        menu.MenuItems.Add("Builder", delegate { ShowUi(); });
        menu.MenuItems.Add("Quitter / Quit", delegate { Close(); });
        tray.ContextMenu = menu;
        tray.DoubleClick += delegate { ShowUi(); };
        listener = new HttpListener();
        listener.Prefixes.Add(Url);
        for (int i = 0; ; i++)
        {
            try { listener.Start(); break; }
            catch (HttpListenerException) { if (i >= 50) throw; Thread.Sleep(200); listener = new HttpListener(); listener.Prefixes.Add(Url); }
        }
        listener.BeginGetContext(OnContext, null);
        Log("server started on " + Url);
        if (!noBrowser) ShowUi();
        ThreadPool.QueueUserWorkItem(delegate { CheckUpdate(); });
        ThreadPool.QueueUserWorkItem(delegate { try { FindGame(); FirstRunAddons(); } catch (Exception ex) { Log("find game: " + ex.Message); } });
        tick = new System.Windows.Forms.Timer { Interval = 200 };
        tick.Tick += OnTick;
        new Thread(() => { Thread.Sleep(20000); FlushShare(); }) { IsBackground = true }.Start();
        tick.Start();
    }

    protected override void SetVisibleCore(bool value) { base.SetVisibleCore(false); }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        tray.Visible = false;
        try { listener.Stop(); } catch { }
        base.OnFormClosed(e);
    }

    const string Repo = "ZKYXYKZ/Azeroth-Survivor-Companion";
    bool watchUi;
    volatile bool updating;
    volatile string latestTag, latestZip, latestSums, updateError = "";

    static string CurrentVersion
    {
        get { Version v = Assembly.GetExecutingAssembly().GetName().Version; return v.Major + "." + v.Minor + "." + v.Build; }
    }

    static WebClient Web()
    {
        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
        WebClient w = new WebClient();
        w.Headers.Add("User-Agent", "AS-Companion/" + CurrentVersion);
        return w;
    }

    void CheckUpdate(bool autoAddons = true)
    {
        try
        {
            string body;
            string api = Environment.GetEnvironmentVariable("AS_COMPANION_RELEASE_URL");
            using (WebClient w = Web()) body = w.DownloadString(string.IsNullOrEmpty(api) ? "https://api.github.com/repos/" + Repo + "/releases/latest" : api);
            Dictionary<string, object> rel = D(json.DeserializeObject(body));
            string tag = S(G(rel, "tag_name"));
            Dictionary<string, string> assets = new Dictionary<string, string>();
            foreach (object a in A(G(rel, "assets"))) assets[S(G(a, "name"))] = S(G(a, "browser_download_url"));
            releaseAssets = assets;
            if (!updating) updateError = "";
            assets.TryGetValue("AzerothSurvivors-Addons.zip", out latestZip);
            assets.TryGetValue("SHA256SUMS.txt", out latestSums);
            string manifest;
            if (assets.TryGetValue("addons.json", out manifest))
                using (WebClient w = Web()) remoteAddons = A(json.DeserializeObject(Utf8.GetString(w.DownloadData(manifest)))).Select(D).Where(x => x != null).ToList();
            FirstRunAddons();
            if (autoAddons) AutoUpdateAddons();
            Version remote, local = new Version(CurrentVersion);
            if (tag == null || !Version.TryParse(tag.TrimStart('v', 'V'), out remote) || remote <= local || latestZip == null) { latestTag = null; return; }
            latestTag = tag;
            Log("update available: " + tag);
        }
        catch (Exception ex) { Log("update check failed: " + ex.Message); }
    }

    volatile string updateStage = "";
    volatile int updateProgress;
    string updatedFrom;
    DateTime updatedAt = DateTime.MinValue;

    byte[] Download(string url)
    {
        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
        HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
        req.UserAgent = "AS-Companion/" + CurrentVersion;
        using (WebResponse res = req.GetResponse())
        using (Stream src = res.GetResponseStream())
        using (MemoryStream ms = new MemoryStream())
        {
            long total = res.ContentLength;
            byte[] buf = new byte[65536];
            int n;
            while ((n = src.Read(buf, 0, buf.Length)) > 0)
            {
                ms.Write(buf, 0, n);
                if (total > 0) updateProgress = (int)(100 * ms.Length / total);
            }
            updateProgress = 100;
            return ms.ToArray();
        }
    }

    void ApplyUpdate()
    {
        try
        {
            updateStage = "download";
            updateProgress = 0;
            byte[] zip = Download(latestZip);
            string sums = null;
            using (WebClient w = Web()) if (latestSums != null) sums = w.DownloadString(latestSums);
            updateStage = "verify";
            string hash;
            using (System.Security.Cryptography.SHA256 sha = System.Security.Cryptography.SHA256.Create())
                hash = BitConverter.ToString(sha.ComputeHash(zip)).Replace("-", "").ToLowerInvariant();
            if (sums == null || !sums.ToLowerInvariant().Contains(hash + "  azerothsurvivors-addons.zip"))
                throw new Exception("SHA-256 mismatch");
            Dictionary<string, object> st = D(LoadState()["settings"]);
            string gamePath = GamePath();
            if (gamePath == null) throw new Exception("game not found");
            string gameDir = Path.GetDirectoryName(gamePath);
            string home = Environment.GetEnvironmentVariable("BENILLA_HOME");
            string addons = Path.Combine(string.IsNullOrEmpty(home) ? Path.Combine(gameDir, "benilla-config") : home, "AddOns");
            string newExe = Path.Combine(exeDir, "ASCompanion.new.exe");
            Dictionary<string, object> upd = LoadState();
            updateStage = "install";
            using (MemoryStream ms = new MemoryStream(zip))
            using (System.IO.Compression.ZipArchive za = new System.IO.Compression.ZipArchive(ms))
            {
                foreach (System.IO.Compression.ZipArchiveEntry e in za.Entries)
                {
                    string n = e.FullName.Replace('\\', '/');
                    if (n.EndsWith("/")) continue;
                    string target = null;
                    if (n == "ASCompanion.exe") target = newExe;
                    else if (n.StartsWith("benilla-config/AddOns/") && !n.Contains(".."))
                    {
                        string rel = n.Substring("benilla-config/AddOns/".Length);
                        string folder = rel.Split('/')[0];
                        if (!Directory.Exists(Path.Combine(addons, folder)) || !AutoAddon(upd, folder)) continue;
                        target = Path.Combine(addons, rel.Replace('/', '\\'));
                    }
                    if (target == null) continue;
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (Stream src = e.Open())
                    using (FileStream dst = File.Create(target)) src.CopyTo(dst);
                }
            }
            Log("update " + latestTag + " extracted");
            updateStage = "restart";
            Thread.Sleep(900);
            BeginInvoke((MethodInvoker)delegate
            {
                string self = Application.ExecutablePath;
                string old = Path.Combine(exeDir, "ASCompanion.old.exe");
                try { File.Delete(old); } catch { }
                File.Move(self, old);
                File.Move(newExe, self);
                Process.Start(self, "--after-update " + CurrentVersion);
                Close();
            });
        }
        catch (Exception ex)
        {
            updateError = ex.Message;
            updating = false;
            updateStage = "";
            Log("update failed: " + ex.Message);
        }
    }

    volatile Dictionary<string, string> releaseAssets = new Dictionary<string, string>();
    volatile List<Dictionary<string, object>> remoteAddons = new List<Dictionary<string, object>>();

    string AddonsDir()
    {
        Dictionary<string, object> st = D(LoadState()["settings"]);
        string gamePath = GamePath() ?? Path.Combine(exeDir, "AzerothSurvivors.exe");
        string home = Environment.GetEnvironmentVariable("BENILLA_HOME");
        return Path.Combine(string.IsNullOrEmpty(home) ? Path.Combine(Path.GetDirectoryName(gamePath), "benilla-config") : home, "AddOns");
    }

    static Dictionary<string, string> Toc(string dir, string name)
    {
        Dictionary<string, string> t = new Dictionary<string, string>();
        string f = Path.Combine(dir, name, name + ".toc");
        if (!File.Exists(f)) return null;
        foreach (string line in File.ReadAllLines(f, Utf8))
        {
            Match m = Regex.Match(line, @"^##\s*([\w-]+)\s*:\s*(.*)$");
            if (m.Success) t[m.Groups[1].Value] = m.Groups[2].Value.Trim();
        }
        return t;
    }

    Dictionary<string, bool> EnabledMap(string dir)
    {
        Dictionary<string, bool> map = new Dictionary<string, bool>();
        string f = Path.Combine(dir, "account.txt");
        if (File.Exists(f))
            foreach (string line in File.ReadAllLines(f))
            {
                Match m = Regex.Match(line, @"^\s*([^:]+?)\s*:\s*(enabled|disabled)\s*$", RegexOptions.IgnoreCase);
                if (m.Success) map[m.Groups[1].Value] = m.Groups[2].Value.ToLowerInvariant() == "enabled";
            }
        return map;
    }

    string buildsAddon = "";
    DateTime buildsAddonAt;

    string BuildsAddonState()
    {
        if (DateTime.Now < buildsAddonAt) return buildsAddon;
        buildsAddonAt = DateTime.Now.AddSeconds(20);
        try
        {
            string dir = AddonsDir();
            bool en;
            buildsAddon = Toc(dir, "SurvivorsBuilds") == null ? "missing" : EnabledMap(dir).TryGetValue("SurvivorsBuilds", out en) && !en ? "disabled" : "ok";
        }
        catch { buildsAddon = ""; }
        return buildsAddon;
    }

    string AddonsJson()
    {
        string dir = AddonsDir();
        Dictionary<string, bool> enabled = EnabledMap(dir);
        List<string> names = remoteAddons.Select(r => S(G(r, "name"))).Where(n => n != null).ToList();
        if (Directory.Exists(dir))
            foreach (string d in Directory.GetDirectories(dir))
            {
                string n = Path.GetFileName(d);
                if (!names.Contains(n) && Toc(dir, n) != null) names.Add(n);
            }
        List<object> list = new List<object>();
        foreach (string n in names)
        {
            Dictionary<string, object> remote = remoteAddons.FirstOrDefault(r => S(G(r, "name")) == n);
            Dictionary<string, string> toc = Toc(dir, n);
            string v;
            Dictionary<string, object> o = new Dictionary<string, object>();
            o["name"] = n;
            o["title"] = remote != null ? S(G(remote, "title")) : toc != null && toc.TryGetValue("Title", out v) ? v : n;
            o["notes"] = remote != null ? S(G(remote, "notes")) : toc != null && toc.TryGetValue("Notes", out v) ? v : "";
            o["notesFr"] = remote != null ? S(G(remote, "notesFr")) : toc != null && toc.TryGetValue("Notes-frFR", out v) ? v : "";
            o["installed"] = toc != null;
            o["version"] = toc != null && toc.TryGetValue("Version", out v) ? v : null;
            o["latest"] = remote != null ? S(G(remote, "version")) : null;
            o["ours"] = remote != null;
            bool en;
            o["enabled"] = !enabled.TryGetValue(n, out en) || en;
            list.Add(o);
        }
        return json.Serialize(new Dictionary<string, object> { { "addons", list }, { "running", running }, { "dir", dir } });
    }

    string AddonAction(string name, string action)
    {
        if (running) return GameLang().StartsWith("fr") ? "Fermez le jeu d'abord" : "Close the game first";
        if (string.IsNullOrEmpty(name) || name.Contains("..") || name.Contains("\\") || name.Contains("/")) return "bad name";
        string dir = AddonsDir();
        string path = Path.Combine(dir, name);
        if (action == "uninstall")
        {
            if (Directory.Exists(path)) Microsoft.VisualBasic.FileIO.FileSystem.DeleteDirectory(path, Microsoft.VisualBasic.FileIO.UIOption.OnlyErrorDialogs, Microsoft.VisualBasic.FileIO.RecycleOption.SendToRecycleBin);
            Log("addon removed: " + name);
            return "";
        }
        if (action == "enable" || action == "disable")
        {
            string f = Path.Combine(dir, "account.txt");
            List<string> lines = File.Exists(f) ? File.ReadAllLines(f).ToList() : new List<string>();
            lines.RemoveAll(l => Regex.IsMatch(l, @"^\s*" + Regex.Escape(name) + @"\s*:"));
            lines.Add(name + ": " + (action == "enable" ? "enabled" : "disabled"));
            File.WriteAllLines(f, lines);
            Log("addon " + action + "d: " + name);
            return "";
        }
        if (action == "install")
        {
            Dictionary<string, object> remote = remoteAddons.FirstOrDefault(r => S(G(r, "name")) == name);
            string file = S(G(remote, "file")), url;
            if (file == null || !releaseAssets.TryGetValue(file, out url)) return "not in the release";
            byte[] zip;
            string sums;
            using (WebClient w = Web())
            {
                zip = w.DownloadData(url);
                sums = latestSums != null ? w.DownloadString(latestSums) : "";
            }
            string hash;
            using (System.Security.Cryptography.SHA256 sha = System.Security.Cryptography.SHA256.Create())
                hash = BitConverter.ToString(sha.ComputeHash(zip)).Replace("-", "").ToLowerInvariant();
            if (!sums.ToLowerInvariant().Contains(hash + "  " + file.ToLowerInvariant())) return "SHA-256 mismatch";
            using (MemoryStream ms = new MemoryStream(zip))
            using (System.IO.Compression.ZipArchive za = new System.IO.Compression.ZipArchive(ms))
                foreach (System.IO.Compression.ZipArchiveEntry e in za.Entries)
                {
                    string n = e.FullName.Replace('\\', '/');
                    if (n.EndsWith("/") || n.Contains("..") || !n.StartsWith(name + "/")) continue;
                    string target = Path.Combine(dir, n.Replace('/', '\\'));
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (Stream src = e.Open())
                    using (FileStream dst = File.Create(target)) src.CopyTo(dst);
                }
            Log("addon installed: " + name + " " + S(G(remote, "version")));
            return "";
        }
        return "unknown action";
    }

    volatile string addonsUpdated = "";
    DateTime addonsUpdatedAt;
    DateTime nextCheck = DateTime.Now.AddMinutes(30);

    static Version ParseVersion(string v)
    {
        Version r;
        return Version.TryParse((v ?? "").Trim().TrimStart('v', 'V'), out r) ? r : new Version(0, 0, 0);
    }

    static bool AutoAddon(Dictionary<string, object> st, string name)
    {
        object set = G(st, "settings");
        return N(G(set, "autoAddons"), 1) != 0 && N(G(G(set, "addonAuto"), name), 1) != 0;
    }

    void AutoUpdateAddons()
    {
        if (running || updating) return;
        Dictionary<string, object> st = LoadState();
        string dir = AddonsDir();
        List<string> done = new List<string>();
        foreach (Dictionary<string, object> r in remoteAddons)
        {
            string name = S(G(r, "name"));
            Dictionary<string, string> toc = name == null ? null : Toc(dir, name);
            if (toc == null || !AutoAddon(st, name)) continue;
            string installed;
            toc.TryGetValue("Version", out installed);
            if (ParseVersion(S(G(r, "version"))) <= ParseVersion(installed)) continue;
            string err;
            try { err = AddonAction(name, "install"); } catch (Exception ex) { err = ex.Message; }
            if (string.IsNullOrEmpty(err)) done.Add(name + " " + S(G(r, "version")));
            else Log("addon auto-update failed: " + name + ": " + err);
        }
        if (done.Count > 0)
        {
            addonsUpdated = string.Join(", ", done);
            addonsUpdatedAt = DateTime.Now;
            Log("addons auto-updated: " + addonsUpdated);
        }
    }

    void Migrate()
    {
        if (File.Exists(stateFile)) return;
        foreach (string p in new[] { Path.Combine(exeDir, "AS-Companion", "state.json"), Path.Combine(exeDir, "state.json") })
        {
            if (File.Exists(p)) { File.Copy(p, stateFile); return; }
        }
    }

    string BugReport()
    {
        string dir = Path.Combine(exeDir, "reports");
        try { Directory.CreateDirectory(dir); File.AppendAllText(Path.Combine(dir, ".w"), ""); File.Delete(Path.Combine(dir, ".w")); }
        catch { dir = Path.Combine(dataDir, "reports"); Directory.CreateDirectory(dir); }
        string zip = Path.Combine(dir, "rapport-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".zip");
        List<string[]> files = new List<string[]>();
        files.Add(new[] { logFile, "companion.log" });
        files.Add(new[] { Path.Combine(dataDir, "runs.json"), "runs.json" });
        files.Add(new[] { stateFile, "state.json" });
        foreach (string rd in new[] { Path.Combine(exeDir, "research"), Path.Combine(dataDir, "research") })
            if (Directory.Exists(rd))
                foreach (string f in new DirectoryInfo(rd).GetFiles("*.jsonl").OrderByDescending(x => x.LastWriteTime).Take(3).Select(x => x.FullName))
                    files.Add(new[] { f, "research/" + Path.GetFileName(f) });
        string gp = GamePath();
        if (gp != null)
        {
            string home = Environment.GetEnvironmentVariable("BENILLA_HOME");
            string cfg = string.IsNullOrEmpty(home) ? Path.Combine(Path.GetDirectoryName(gp), "benilla-config") : home;
            files.Add(new[] { Path.Combine(cfg, "saved", "SurvivorsBuilds.lua"), "saved/SurvivorsBuilds.lua" });
            files.Add(new[] { Path.Combine(cfg, "AddOns", "account.txt"), "AddOns/account.txt" });
        }
        string info = "version " + CurrentVersion + "\r\nwindows " + Environment.OSVersion + "\r\ngame " + gp + "\r\nexe " + exeDir + "\r\nrunning " + running + "\r\n";
        using (FileStream fs = File.Create(zip))
        using (System.IO.Compression.ZipArchive za = new System.IO.Compression.ZipArchive(fs, System.IO.Compression.ZipArchiveMode.Create))
        {
            using (StreamWriter w = new StreamWriter(za.CreateEntry("info.txt").Open(), Utf8)) w.Write(info);
            foreach (string[] f in files)
            {
                if (f[0] == null || !File.Exists(f[0])) continue;
                try
                {
                    using (FileStream src = new FileStream(f[0], FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                    using (Stream dst = za.CreateEntry(f[1]).Open()) src.CopyTo(dst);
                }
                catch { }
            }
        }
        Log("bug report " + zip);
        Process.Start("explorer.exe", "/select,\"" + zip + "\"");
        return zip;
    }

    void Log(string m)
    {
        if (replaying) return;
        try { File.AppendAllText(logFile, DateTime.Now.ToString("HH:mm:ss") + " " + m + "\r\n", Utf8); } catch { }
    }

    static byte[] Resource(string name)
    {
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("web/" + name))
        {
            if (s == null) return null;
            MemoryStream ms = new MemoryStream();
            s.CopyTo(ms);
            return ms.ToArray();
        }
    }

    Form uiForm;
    bool askedRuntime;

    void ShowUi()
    {
        if (uiForm != null && !uiForm.IsDisposed)
        {
            uiForm.Show();
            if (uiForm.WindowState == FormWindowState.Minimized) uiForm.WindowState = FormWindowState.Normal;
            uiForm.Activate();
            return;
        }
        if (Web2.Available())
        {
            try
            {
                uiForm = Web2.Create(Url, Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AS-Companion", "webview"));
                uiForm.FormClosing += OnUiClosing;
                uiForm.Show();
                uiForm.TopMost = true;
                uiForm.Activate();
                uiForm.TopMost = false;
                watchUi = false;
                return;
            }
            catch (Exception ex) { Log("webview error: " + ex.Message); uiForm = null; }
        }
        else if (!askedRuntime)
        {
            askedRuntime = true;
            bool fr = GameLang().StartsWith("fr");
            DialogResult r = MessageBox.Show(fr
                ? "AS Companion a besoin du composant Microsoft WebView2 pour afficher sa fenêtre.\n\nLe télécharger et l'installer maintenant (environ 2 Mo, gratuit, de Microsoft) ?\nEn attendant, l'interface s'ouvre dans votre navigateur."
                : "AS Companion needs the Microsoft WebView2 component to show its window.\n\nDownload and install it now (about 2 MB, free, from Microsoft)?\nMeanwhile, the interface opens in your browser.",
                "AS Companion", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
            if (r == DialogResult.Yes) ThreadPool.QueueUserWorkItem(delegate { InstallWebView2(); });
        }
        ui = OpenUi();
        watchUi = ui != null;
        if (ui == null) Log("opened the default browser; quit from the tray icon");
    }

    void OnUiClosing(object sender, FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.WindowsShutDown || e.CloseReason == CloseReason.ApplicationExitCall || e.CloseReason == CloseReason.TaskManagerClosing) return;
        if (running)
        {
            e.Cancel = true;
            uiForm.Hide();
            tray.ShowBalloonTip(4000, "AS Companion", GameLang().StartsWith("fr") ? "Le compagnon reste actif pendant la partie." : "The companion stays on while the game runs.", ToolTipIcon.Info);
            return;
        }
        Log("ui closed");
        BeginInvoke((MethodInvoker)delegate { Close(); });
    }

    void InstallWebView2()
    {
        try
        {
            string setup = Path.Combine(Path.GetTempPath(), "MicrosoftEdgeWebview2Setup.exe");
            using (WebClient w = Web()) w.DownloadFile("https://go.microsoft.com/fwlink/p/?LinkId=2124703", setup);
            Log("installing WebView2");
            Process p = Process.Start(setup, "/silent /install");
            p.WaitForExit();
            Log("WebView2 setup exit " + p.ExitCode);
            BeginInvoke((MethodInvoker)delegate
            {
                if (!Web2.Available()) { MessageBox.Show(GameLang().StartsWith("fr") ? "L'installation de WebView2 a échoué. L'interface reste dans votre navigateur." : "WebView2 setup failed. The interface stays in your browser.", "AS Companion"); return; }
                watchUi = false;
                ShowUi();
            });
        }
        catch (Exception ex) { Log("WebView2 install failed: " + ex.Message); }
    }

    static Process OpenUi()
    {
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] candidates = {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(local, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
        };
        string edge = candidates.FirstOrDefault(File.Exists);
        if (edge == null)
        {
            Process.Start(Url);
            return null;
        }
        string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AS-Companion", "ui");
        return Process.Start(edge, "--app=" + Url + " --user-data-dir=\"" + dir + "\" --window-size=1280,900 --no-first-run --no-default-browser-check");
    }

    bool UiAlive()
    {
        try
        {
            using (System.Management.ManagementObjectSearcher q = new System.Management.ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE Name = 'msedge.exe' OR Name = 'chrome.exe'"))
                foreach (System.Management.ManagementObject o in q.Get())
                {
                    string cmd = o["CommandLine"] as string;
                    if (cmd != null && cmd.IndexOf(uiDir, StringComparison.OrdinalIgnoreCase) >= 0) return true;
                }
            return false;
        }
        catch { return true; }
    }

    string combatLog;
    long combatPos;
    DateTime combatRead = DateTime.MinValue;
    Dictionary<string, double> spellDmg = new Dictionary<string, double>();
    double totalDmg;
    static readonly Regex HitLine = new Regex(@"^\S+ \S+\s+Your (.+?) (?:hits|crits) (.+?) for (\d+)", RegexOptions.Compiled);
    static readonly Regex TickLine = new Regex(@"^\S+ \S+\s+(.+?) suffers (\d+) .*?from your (.+?)\.", RegexOptions.Compiled);
    static readonly Regex MeleeLine = new Regex(@"^\S+ \S+\s+You (?:hit|crit) (.+?) for (\d+)", RegexOptions.Compiled);
    static readonly Regex OtherHit = new Regex(@"^\S+ \S+\s+(.+?) (?:hits|crits) (.+?) for (\d+)", RegexOptions.Compiled);
    static readonly Regex DiesLine = new Regex(@"^\S+ \S+\s+(.+?) dies\.", RegexOptions.Compiled);
    static readonly Dictionary<string, string[]> ClassPets = new Dictionary<string, string[]>
    {
        { "hunter", new[] { "Loup", "Wolf", "Raptor" } },
        { "druid", new[] { "Tréant", "Treant" } },
    };
    HashSet<string> hostiles = new HashSet<string>();

    bool OwnPet(string name)
    {
        if (coopSize <= 1) return true;
        string[] pets;
        return heroClass != null && ClassPets.TryGetValue(S(heroClass["key"]), out pets) && pets.Contains(name);
    }

    void ReadCombat()
    {
        if (combatLog == null || !File.Exists(combatLog)) return;
        try
        {
            using (FileStream fs = new FileStream(combatLog, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                if (fs.Length < combatPos) combatPos = 0;
                if (fs.Length == combatPos) return;
                fs.Seek(combatPos, SeekOrigin.Begin);
                byte[] buf = new byte[fs.Length - combatPos];
                int n = fs.Read(buf, 0, buf.Length);
                int last = Array.LastIndexOf(buf, (byte)'\n', n - 1);
                if (last < 0) return;
                combatPos += last + 1;
                foreach (string line in Utf8.GetString(buf, 0, last + 1).Split('\n'))
                {
                    Match m = TakenLine.Match(line);
                    if (m.Success)
                    {
                        double t = double.Parse(m.Groups[2].Value), tv;
                        hostiles.Add(m.Groups[1].Value);
                        dmgTaken += t;
                        takenBy.TryGetValue(m.Groups[1].Value, out tv);
                        takenBy[m.Groups[1].Value] = tv + t;
                        continue;
                    }
                    m = HitLine.Match(line);
                    if (m.Success) { hostiles.Add(m.Groups[2].Value); AddDmg(m.Groups[1].Value, double.Parse(m.Groups[3].Value), line.Contains(" crits ")); continue; }
                    m = TickLine.Match(line);
                    if (m.Success) { hostiles.Add(m.Groups[1].Value); AddDmg(m.Groups[3].Value, double.Parse(m.Groups[2].Value), false); continue; }
                    m = MeleeLine.Match(line);
                    if (m.Success) { hostiles.Add(m.Groups[1].Value); AddDmg("Attack", double.Parse(m.Groups[2].Value), line.Contains("You crit ")); continue; }
                    m = DiesLine.Match(line);
                    if (m.Success) { hostiles.Add(m.Groups[1].Value); continue; }
                    m = OtherHit.Match(line);
                    int petTree;
                    if (m.Success && detectedTree < 0 && coopSize <= 1 && !hostiles.Contains(m.Groups[1].Value) && hostiles.Contains(m.Groups[2].Value) && capPets.TryGetValue(m.Groups[1].Value, out petTree)) DetectSpec(petTree, "pet " + m.Groups[1].Value);
                    if (m.Success && !hostiles.Contains(m.Groups[1].Value) && hostiles.Contains(m.Groups[2].Value) && OwnPet(m.Groups[1].Value))
                        AddDmg("Pets", double.Parse(m.Groups[3].Value), line.Contains(" crits "));
                }
            }
        }
        catch (IOException) { }
        if (totalDmg > 0 && DateTime.Now > dpsLog)
        {
            dpsLog = DateTime.Now.AddSeconds(60);
            ResearchCombat();
            ResearchIo();
            runMinutes.Add(new Dictionary<string, object> { { "dps", Math.Round((totalDmg - minuteDmg) / 60) }, { "taken", Math.Round(dmgTaken - minuteTaken) }, { "level", runLevel } });
            minuteDmg = totalDmg;
            minuteTaken = dmgTaken;
            Log("dps " + string.Join(", ", spellDmg.OrderByDescending(kv => kv.Value).Take(6).Select(kv => kv.Key + " " + Math.Round(100 * kv.Value / totalDmg) + "%")));
        }
    }

    DateTime dpsLog = DateTime.MinValue;
    static readonly Regex TakenLine = new Regex(@"^\S+ \S+\s+(.+?) (?:hits|crits) you for (\d+)", RegexOptions.Compiled);
    Dictionary<string, int> spellHits = new Dictionary<string, int>(), spellCrits = new Dictionary<string, int>();
    Dictionary<string, double> takenBy = new Dictionary<string, double>();
    double dmgTaken;
    string researchFile;
    string[] lastScores = new string[0];

    void StartResearch(string cls)
    {
        if (replaying) return;
        researchFile = null;
        spellHits = new Dictionary<string, int>();
        spellCrits = new Dictionary<string, int>();
        takenBy = new Dictionary<string, double>();
        dmgTaken = 0;
        string name = DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Regex.Replace(cls ?? "hero", @"[^\w-]", "") + ".jsonl";
        foreach (string dir in new[] { Path.Combine(exeDir, "research"), Path.Combine(dataDir, "research") })
        {
            try
            {
                Directory.CreateDirectory(dir);
                string f = Path.Combine(dir, name);
                File.AppendAllText(f, "");
                researchFile = f;
                return;
            }
            catch { }
        }
    }

    void Research(string kind, object payload)
    {
        if (researchFile == null) return;
        try
        {
            Dictionary<string, object> e = new Dictionary<string, object> { { "t", kind }, { "at", DateTime.Now.ToString("HH:mm:ss") }, { "data", payload } };
            File.AppendAllText(researchFile, json.Serialize(e) + "\n", Utf8);
        }
        catch { }
    }

    void ResearchCombat()
    {
        Research("combat", new Dictionary<string, object> { { "dmg", spellDmg.ToDictionary(kv => kv.Key, kv => (object)Math.Round(kv.Value)) }, { "hits", spellHits }, { "crits", spellCrits }, { "taken", Math.Round(dmgTaken) }, { "takenBy", takenBy.OrderByDescending(kv => kv.Value).Take(10).ToDictionary(kv => kv.Key, kv => (object)Math.Round(kv.Value)) } });
    }

    void AddDmg(string spellName, double dmg, bool crit)
    {
        string key = spellName;
        string bare = Regex.Replace(spellName, " (Aura|Effect)$", "");
        if (heroClass != null)
            foreach (object sp in A(G(heroClass, "spells")))
            {
                string en = S(G(G(sp, "name"), "en"));
                if (en == spellName || en == bare) { key = S(G(sp, "key")); break; }
            }
        int capTree;
        KeyValuePair<string, int> capLog;
        if (detectedTree < 0 && heroClass != null && CapLog.TryGetValue(spellName, out capLog) && capLog.Key == S(heroClass["key"])) DetectSpec(capLog.Value, "log " + spellName);
        if (detectedTree < 0 && !offeredNew.Contains(key) && !owned.ContainsKey(key) && capSpells.TryGetValue(key, out capTree)) DetectSpec(capTree, "log " + key);
        double v;
        spellDmg.TryGetValue(key, out v);
        spellDmg[key] = v + dmg;
        totalDmg += dmg;
        int c;
        spellHits.TryGetValue(key, out c);
        spellHits[key] = c + 1;
        if (crit) { spellCrits.TryGetValue(key, out c); spellCrits[key] = c + 1; }
    }

    double DmgShare(string key)
    {
        double v;
        return totalDmg > 0 && spellDmg.TryGetValue(key, out v) ? v / totalDmg : 0;
    }

    double DmgFactor(string key)
    {
        if (totalDmg < 20000 || !spellDmg.ContainsKey(key)) return 1;
        return Math.Max(0.3, Math.Min(2, 0.3 + 3 * DmgShare(key)));
    }

    Dictionary<string, List<Dictionary<string, object>>> gatewayAll = new Dictionary<string, List<Dictionary<string, object>>>();
    int gamePick = -1;
    string pickActive;
    static readonly Dictionary<string, KeyValuePair<string, int>> CapLog = new Dictionary<string, KeyValuePair<string, int>>
    {
        { "Noxious Cloud", new KeyValuePair<string, int>("rogue", 0) },
    };

    Dictionary<string, object> LastPicks()
    {
        string f = Path.Combine(dataDir, "last-pick.json");
        try { return File.Exists(f) ? D(json.DeserializeObject(File.ReadAllText(f, Utf8))) ?? new Dictionary<string, object>() : new Dictionary<string, object>(); }
        catch { return new Dictionary<string, object>(); }
    }
    DateTime pickRead;
    Bitmap pickPixel = new Bitmap(1, 1);

    void ReadGamePick()
    {
        Process p = Process.GetProcessesByName("AzerothSurvivors").FirstOrDefault();
        if (p == null) { gamePick = -1; return; }
        IntPtr h = p.MainWindowHandle;
        if (h == IntPtr.Zero || GetForegroundWindow() != h) return;
        IntPtr dpi = IntPtr.Zero;
        try { dpi = SetThreadDpiAwarenessContext((IntPtr)(-4)); } catch { }
        try
        {
            POINT o = new POINT();
            ClientToScreen(h, ref o);
            using (Graphics g = Graphics.FromImage(pickPixel)) g.CopyFromScreen(o.X + 1, o.Y + 1, 0, 0, new Size(1, 1));
            Color c = pickPixel.GetPixel(0, 0);
            if (c.G < 240 || Math.Abs(c.R % 16 - 8) > 2 || Math.Abs(c.B % 16 - 8) > 2) return;
            int v = c.R / 16 + 16 * (c.B / 16);
            if (v == gamePick) return;
            int prev = gamePick;
            gamePick = v;
            pickActive = heroClass != null ? S(G(ActiveBuild(state, S(heroClass["key"])), "id")) ?? "" : "?";
            if (v > 0 || prev > 0) ApplyGamePick();
        }
        catch { }
        finally { try { if (dpi != IntPtr.Zero) SetThreadDpiAwarenessContext(dpi); } catch { } }
    }

    void ApplyGamePick()
    {
        if (heroClass == null) return;
        string ck = S(heroClass["key"]);
        Dictionary<string, object> pick = null;
        List<Dictionary<string, object>> sent;
        bool companionNewer = pickActive != "?" && (S(G(ActiveBuild(state, ck), "id")) ?? "") != pickActive;
        if (gamePick > 0 && !companionNewer && gatewayAll.TryGetValue(ck, out sent) && gamePick <= sent.Count)
        {
            Dictionary<string, object> g = sent[gamePick - 1];
            pick = A(G(state, "builds")).Select(D).FirstOrDefault(b => G(g, "id") != null && S(G(b, "id")) == S(G(g, "id"))) ?? g;
        }
        if (pick != null)
        {
            Dictionary<string, object> lp = LastPicks();
            lp[ck] = new Dictionary<string, object> { { "name", S(G(pick, "name")) }, { "active", S(G(ActiveBuild(state, ck), "id")) ?? "" } };
            try { File.WriteAllText(Path.Combine(dataDir, "last-pick.json"), json.Serialize(lp), Utf8); } catch { }
        }
        if (pick == null && detectedTree < 0 && gamePick <= 0)
        {
            Dictionary<string, object> last = D(G(LastPicks(), ck));
            List<Dictionary<string, object>> all;
            if (last != null && (S(G(ActiveBuild(state, ck), "id")) ?? "") == S(G(last, "active")) && gatewayAll.TryGetValue(ck, out all))
            {
                Dictionary<string, object> g = all.FirstOrDefault(x => S(G(x, "name")) == S(G(last, "name")));
                if (g != null) pick = A(G(state, "builds")).Select(D).FirstOrDefault(b => G(g, "id") != null && S(G(b, "id")) == S(G(g, "id"))) ?? g;
            }
        }
        if (pick == null && detectedTree >= 0) pick = A(G(state, "builds")).Select(D).FirstOrDefault(b => S(G(b, "class")) == ck && SpecIndex(b) == detectedTree) ?? PresetFor(heroClass, detectedTree);
        if (pick == null) pick = ActiveBuild(state, ck) ?? ClassPresets(heroClass).FirstOrDefault();
        if (pick == null || pick == build) return;
        build = pick;
        Log("build chosen in game: " + S(G(build, "name")));
    }

    void OnTick(object sender, EventArgs e)
    {
        if (DateTime.Now > pickRead) { pickRead = DateTime.Now.AddSeconds(1); ReadGamePick(); }
        if (running && DateTime.Now > combatRead) { combatRead = DateTime.Now.AddSeconds(1); ReadCombat(); }
        if (running && game != null && game.HasExited)
        {
            running = false;
            advice = "";
            pendingKey = 0;
            overlay.Hide();
            Log("game exited");
            ReadAddonRuns(savedFile);
            AttachDetails(savedFile);
            new Thread(FlushShare) { IsBackground = true }.Start();
        }
        if (pendingKey != 0 && running && (DateTime.Now - pendingAt).TotalMilliseconds > 500)
        {
            // X fait asseoir le héros hors des cartes : un seul renvoi, comme Entrée
            if (pendingTries >= (pendingKey == 0x0D || pendingKey == 0x58 ? 1 : 6)) { Log("key not taken by the game"); pendingKey = 0; }
            else { SendKey(pendingKey); pendingTries++; Log("key resent (" + pendingTries + ")"); }
        }
        if (!running && !updating && DateTime.Now > nextCheck)
        {
            nextCheck = DateTime.Now.AddMinutes(30);
            ThreadPool.QueueUserWorkItem(delegate { CheckUpdate(); });
        }
        if (watchUi && !running && !updating && DateTime.Now > uiCheck)
        {
            uiCheck = DateTime.Now.AddSeconds(2);
            if ((ui == null || ui.HasExited) && !UiAlive()) { Log("ui closed"); Close(); }
        }
    }

    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
    struct RECT { public int Left, Top, Right, Bottom; }
    struct POINT { public int X, Y; }
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern void mouse_event(uint f, int x, int y, uint d, IntPtr e);
    [DllImport("user32.dll")] static extern void keybd_event(byte k, byte s, uint f, IntPtr e);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);

    int lastReset;
    static readonly Dictionary<string, Color> ClassColors = new Dictionary<string, Color> {
        { "warrior", ColorTranslator.FromHtml("#C79C6E") }, { "paladin", ColorTranslator.FromHtml("#F58CBA") }, { "hunter", ColorTranslator.FromHtml("#ABD473") },
        { "rogue", ColorTranslator.FromHtml("#FFF569") }, { "priest", ColorTranslator.FromHtml("#FFFFFF") }, { "shaman", ColorTranslator.FromHtml("#0070DE") },
        { "mage", ColorTranslator.FromHtml("#69CCF0") }, { "warlock", ColorTranslator.FromHtml("#9482C9") }, { "druid", ColorTranslator.FromHtml("#FF7D0A") } };

    string ApplyTalents(object b)
    {
        Process p = Process.GetProcessesByName("AzerothSurvivors").FirstOrDefault();
        if (p == null) return "nogame";
        IntPtr h = p.MainWindowHandle;
        object cls = A(G(data, "classes")).FirstOrDefault(c => S(G(c, "key")) == S(G(b, "class")));
        if (cls == null || h == IntPtr.Zero) return "nogame";
        object tal = G(b, "talents");
        List<object> trees = A(G(cls, "trees")).ToList();
        int[] pts = trees.Select(t => A(G(t, "talents")).Sum(x => (int)N(G(tal, S(G(x, "key"))), 0))).ToArray();
        if (pts.Sum() == 0) return "empty";
        int main = Array.IndexOf(pts, pts.Max());
        List<int[]> order = new List<int[]>();
        foreach (int ti in new[] { main }.Concat(Enumerable.Range(0, trees.Count).Where(i => i != main)))
            foreach (object x in A(G(trees[ti], "talents")).OrderBy(x => N(G(x, "row"), 0)).ThenBy(x => N(G(x, "col"), 0)))
            {
                int n = (int)N(G(tal, S(G(x, "key"))), 0);
                if (n > 0) order.Add(new[] { ti, (int)N(G(x, "row"), 0), (int)N(G(x, "col"), 0), n });
            }
        RECT r;
        GetClientRect(h, out r);
        int cw = r.Right - r.Left, ch = r.Bottom - r.Top;
        double sc = Math.Min(cw / 1920.0, ch / 1080.0), ox = (cw - 1920 * sc) / 2, oy = (ch - 1080 * sc) / 2;
        Log("apply talents: game client " + cw + "x" + ch);
        POINT o = new POINT();
        ClientToScreen(h, ref o);
        for (int i = 0; i < 5 && GetForegroundWindow() != h; i++) { SetForegroundWindow(h); Thread.Sleep(300); }
        for (int i = 0; i < 3 && GetForegroundWindow() != h; i++)
        {
            keybd_event(0x12, 0, 0, IntPtr.Zero);
            keybd_event(0x12, 0, 2, IntPtr.Zero);
            if (IsIconic(h)) ShowWindow(h, 9);
            SetForegroundWindow(h);
            Thread.Sleep(300);
        }
        if (GetForegroundWindow() != h) return "focus";
        Thread.Sleep(1500);
        int lastX = -1, lastY = -1;
        Func<int, int, int, bool> click = (x, y, wait) =>
        {
            if (GetForegroundWindow() != h) return false;
            if (x != lastX || y != lastY)
            {
                SetCursorPos(o.X + (int)(ox + x * sc), o.Y + (int)(oy + y * sc));
                Thread.Sleep(30);
                lastX = x;
                lastY = y;
            }
            mouse_event(0x02, 0, 0, 0, IntPtr.Zero);
            Thread.Sleep(25);
            mouse_event(0x04, 0, 0, 0, IntPtr.Zero);
            Thread.Sleep(wait);
            return true;
        };
        Color seen = Color.Black;
        int seenV = -1;
        int cx = o.X + (int)(ox + 48 * sc), cy = o.Y + (int)(oy + 92 * sc), cwid = Math.Max(1, (int)(82 * sc)), chei = Math.Max(1, (int)(20 * sc));
        using (Bitmap cb = new Bitmap(cwid, chei))
        {
            using (Graphics g = Graphics.FromImage(cb)) g.CopyFromScreen(cx, cy, 0, 0, cb.Size);
            for (int x = 0; x < cwid; x++)
                for (int y = 0; y < chei; y++)
                {
                    Color c = cb.GetPixel(x, y);
                    int v = Math.Max(c.R, Math.Max(c.G, c.B)) - Math.Min(c.R, Math.Min(c.G, c.B)) + (c.R + c.G + c.B) / 3;
                    if (v > seenV) { seenV = v; seen = c; }
                }
        }
        string seenClass = ClassColors.OrderBy(kv => Math.Pow(kv.Value.R - seen.R, 2) + Math.Pow(kv.Value.G - seen.G, 2) + Math.Pow(kv.Value.B - seen.B, 2)).First().Key;
        if (seenClass != S(G(b, "class"))) { Log("apply talents: armory shows " + seenClass + " (" + seen.R + "," + seen.G + "," + seen.B + "), build is " + S(G(b, "class"))); return "wrongclass"; }
        Func<int> findReset = () =>
        {
            int best = 0, bestStart = -1, run = 0, start = -1;
            int rh = Math.Max(1, (int)(260 * sc));
            using (Bitmap bmp = new Bitmap(1, rh))
            {
                using (Graphics g = Graphics.FromImage(bmp)) g.CopyFromScreen(o.X + (int)(ox + 1516 * sc), o.Y + (int)(oy + 380 * sc), 0, 0, bmp.Size);
                for (int i = 0; i < 260; i++)
                {
                    Color c = bmp.GetPixel(0, Math.Min(rh - 1, (int)(i * sc)));
                    if (c.R >= 25 && c.R > 2 * c.G && c.R > 2 * c.B) { if (run == 0) start = i; run++; if (run > best) { best = run; bestStart = start; } }
                    else run = 0;
                }
            }
            return best >= 8 ? 380 + bestStart + best / 2 : -1;
        };
        lastReset = findReset();
        if (lastReset < 0 && order.Count > 0)
        {
            if (!click(116 + 480 * order[0][0] + 108 * order[0][2], 241 + 89 * order[0][1], 1500)) return "focus";
            lastReset = findReset();
        }
        if (lastReset >= 0 && !click(1549, lastReset, 700)) return "focus";
        foreach (int[] e in order)
            for (int i = 0; i < e[3]; i++)
                if (!click(116 + 480 * e[0] + 108 * e[2], 241 + 89 * e[1], 40)) return "focus";
        Log("talents applied: " + S(G(b, "name")) + ", " + order.Count + " talents");
        return "ok";
    }

    void SendKey(uint vk)
    {
        pendingAt = DateTime.Now;
        game.Refresh();
        Native.Press(game.MainWindowHandle, vk);
    }

    void OnContext(IAsyncResult ar)
    {
        HttpListenerContext ctx;
        try { ctx = listener.EndGetContext(ar); } catch { return; }
        try { listener.BeginGetContext(OnContext, null); } catch { }
        try { Invoke((MethodInvoker)delegate { Serve(ctx); }); } catch { }
    }

    static void Respond(HttpListenerContext ctx, int code, string type, byte[] bytes)
    {
        ctx.Response.StatusCode = code;
        ctx.Response.ContentType = type;
        ctx.Response.Headers.Add("Cache-Control", "no-store");
        ctx.Response.ContentLength64 = bytes.Length;
        ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
        ctx.Response.OutputStream.Close();
    }

    void Serve(HttpListenerContext ctx)
    {
        string path = ctx.Request.Url.AbsolutePath;
        string method = ctx.Request.HttpMethod;
        try
        {
            if (path == "/api/state" && method == "GET") { Respond(ctx, 200, "application/json", Utf8.GetBytes(StateJson())); return; }
            if (path == "/api/state" && method == "POST")
            {
                string body = new StreamReader(ctx.Request.InputStream, Utf8).ReadToEnd();
                Dictionary<string, object> fresh = D(json.DeserializeObject(body));
                File.WriteAllText(stateFile, body, Utf8);
                if (running && fresh != null)
                    BeginInvoke((MethodInvoker)delegate
                    {
                        state = fresh;
                        settings = D(G(fresh, "settings")) ?? settings;
                        if (heroClass == null) return;
                        Dictionary<string, object> active = ActiveBuild(state, S(heroClass["key"]));
                        string keep = detectedTree >= 0 ? S(G(build, "id")) : null;
                        Dictionary<string, object> same = keep == null ? null : A(G(state, "builds")).Select(D).FirstOrDefault(b => S(G(b, "id")) == keep);
                        build = same != null && SpecIndex(active) != detectedTree ? same : active;
                    });
                Respond(ctx, 200, "application/json", Utf8.GetBytes("{\"ok\":true}"));
                return;
            }
            if (path == "/api/apply-talents" && method == "POST")
            {
                string body;
                using (StreamReader sr = new StreamReader(ctx.Request.InputStream, Utf8)) body = sr.ReadToEnd();
                string res;
                IntPtr dpi = IntPtr.Zero;
                try { dpi = SetThreadDpiAwarenessContext((IntPtr)(-4)); } catch { }
                try { res = ApplyTalents(json.DeserializeObject(body)); }
                catch (Exception ex) { res = "error"; Log("apply talents error: " + ex); }
                finally { try { if (dpi != IntPtr.Zero) SetThreadDpiAwarenessContext(dpi); } catch { } }
                if (res != "ok") Log("apply talents: " + res);
                Respond(ctx, 200, "application/json", Utf8.GetBytes("{\"result\":\"" + res + "\",\"reset\":" + lastReset + "}"));
                return;
            }
            if (path == "/api/launch" && method == "POST")
            {
                if (!running) Launch();
                Respond(ctx, 200, "application/json", Utf8.GetBytes("{\"ok\":true}"));
                return;
            }
            if (path == "/api/community/stats" || path == "/api/community/i18n")
            {
                bool stats = path.EndsWith("stats");
                byte[] body = CommunityGet(stats ? "/api/stats" : "/i18n.json", stats ? 60 : 3600);
                Respond(ctx, body != null ? 200 : 502, "application/json", body ?? Utf8.GetBytes("{\"error\":\"offline\"}"));
                return;
            }
            if (path == "/api/runs")
            {
                string rf = Path.Combine(dataDir, "runs.json");
                Respond(ctx, 200, "application/json", File.Exists(rf) ? File.ReadAllBytes(rf) : Utf8.GetBytes("[]"));
                return;
            }
            if (path == "/api/status")
            {
                Respond(ctx, 200, "application/json", Utf8.GetBytes(json.Serialize(new Dictionary<string, object> { { "running", running }, { "advice", advice }, { "spec", running ? specNote : "" }, { "error", error }, { "version", CurrentVersion }, { "update", latestTag }, { "updating", updating }, { "updateStage", updateStage }, { "updateProgress", updateProgress }, { "updatedFrom", (DateTime.Now - updatedAt).TotalSeconds < 60 ? updatedFrom : null }, { "updateError", updateError }, { "addonsUpdated", (DateTime.Now - addonsUpdatedAt).TotalMinutes < 2 ? addonsUpdated : "" }, { "game", GamePath() }, { "buildsAddon", BuildsAddonState() } })));
                return;
            }
            if (path == "/api/browse" && method == "POST")
            {
                string picked = Browse(new StreamReader(ctx.Request.InputStream, Utf8).ReadToEnd());
                Respond(ctx, 200, "application/json", Utf8.GetBytes(json.Serialize(new Dictionary<string, object> { { "path", picked } })));
                return;
            }
            if (path == "/api/update" && method == "POST")
            {
                if (running) updateError = GameLang().StartsWith("fr") ? "Fermez le jeu avant de mettre à jour" : "Close the game before updating";
                else if (!updating && latestZip != null) { updating = true; updateError = ""; ThreadPool.QueueUserWorkItem(delegate { ApplyUpdate(); }); }
                Respond(ctx, 200, "application/json", Utf8.GetBytes("{\"ok\":true}"));
                return;
            }
            if (path == "/api/check" && method == "POST")
            {
                CheckUpdate(ctx.Request.QueryString["addons"] == null);
                Respond(ctx, 200, "application/json", Utf8.GetBytes(json.Serialize(new Dictionary<string, object> { { "version", CurrentVersion }, { "update", latestTag }, { "updateError", updateError } })));
                return;
            }
            if (path == "/api/addons" && method == "GET")
            {
                Respond(ctx, 200, "application/json", Utf8.GetBytes(AddonsJson()));
                return;
            }
            if (path == "/api/addons" && method == "POST")
            {
                Dictionary<string, object> req = D(json.DeserializeObject(new StreamReader(ctx.Request.InputStream, Utf8).ReadToEnd()));
                string err;
                try { err = AddonAction(S(G(req, "name")), S(G(req, "action"))); } catch (Exception ex) { err = ex.Message; }
                buildsAddonAt = DateTime.MinValue;
                Respond(ctx, 200, "application/json", Utf8.GetBytes(json.Serialize(new Dictionary<string, object> { { "error", err } })));
                return;
            }
            if (path == "/api/show" && method == "POST")
            {
                ShowUi();
                Respond(ctx, 200, "application/json", Utf8.GetBytes("{}"));
                return;
            }
            if (path == "/api/report" && method == "POST")
            {
                string zip = null, err = null;
                try { zip = BugReport(); } catch (Exception ex) { err = ex.Message; }
                Respond(ctx, 200, "application/json", Utf8.GetBytes(json.Serialize(new Dictionary<string, object> { { "path", zip }, { "error", err } })));
                return;
            }
            if (path == "/api/open" && method == "POST")
            {
                string target = new StreamReader(ctx.Request.InputStream, Utf8).ReadToEnd();
                if (target.StartsWith("https://x.com/") || target.StartsWith("https://github.com/") || target.StartsWith("https://www.buymeacoffee.com/")) Process.Start(target);
                Respond(ctx, 200, "application/json", Utf8.GetBytes("{\"ok\":true}"));
                return;
            }
            string file = path == "/" ? "index.html" : path.TrimStart('/');
            byte[] bytes = file.Contains("..") ? null : Resource(file);
            if (bytes == null) { Respond(ctx, 404, "text/plain", Utf8.GetBytes("not found")); return; }
            string ext = Path.GetExtension(file);
            string type = ext == ".html" ? "text/html; charset=utf-8" : ext == ".js" ? "application/javascript; charset=utf-8" : ext == ".css" ? "text/css; charset=utf-8"
                : ext == ".json" ? "application/json" : ext == ".jpg" ? "image/jpeg" : ext == ".png" ? "image/png" : ext == ".ico" ? "image/x-icon" : "application/octet-stream";
            Respond(ctx, 200, type, bytes);
        }
        catch (Exception ex)
        {
            Log("http error " + path + " : " + ex.Message);
            try { Respond(ctx, 500, "text/plain", Utf8.GetBytes(ex.Message)); } catch { }
        }
    }

    string Browse(string current)
    {
        using (Form owner = new Form { TopMost = true, ShowInTaskbar = false, StartPosition = FormStartPosition.CenterScreen, Width = 1, Height = 1, FormBorderStyle = FormBorderStyle.None, Opacity = 0 })
        using (OpenFileDialog dlg = new OpenFileDialog())
        {
            owner.Show();
            owner.Activate();
            dlg.Title = "AzerothSurvivors.exe";
            dlg.Filter = "AzerothSurvivors.exe|AzerothSurvivors.exe|*.exe|*.exe";
            if (!string.IsNullOrEmpty(current) && File.Exists(current)) { dlg.InitialDirectory = Path.GetDirectoryName(current); dlg.FileName = Path.GetFileName(current); }
            return dlg.ShowDialog(owner) == DialogResult.OK ? dlg.FileName : null;
        }
    }

    static Dictionary<string, object> D(object o) { return o as Dictionary<string, object>; }
    static object G(object o, string k) { Dictionary<string, object> d = D(o); object v; return d != null && d.TryGetValue(k, out v) ? v : null; }
    static string S(object o) { return o == null ? null : Convert.ToString(o, System.Globalization.CultureInfo.InvariantCulture); }
    static double N(object o, double def) { if (o == null) return def; try { return Convert.ToDouble(o, System.Globalization.CultureInfo.InvariantCulture); } catch { return def; } }
    static bool B(object o) { return o is bool ? (bool)o : N(o, 0) != 0; }
    static IEnumerable<object> A(object o) { IEnumerable e = o as IEnumerable; return e == null || o is string ? new object[0] : e.Cast<object>(); }
    string Loc(object o) { return S(G(o, lang)) ?? S(G(o, "en")) ?? ""; }

    const string GameExe = "AzerothSurvivors.exe";
    volatile string detectedGame;

    string GamePath()
    {
        string saved = S(G(D(LoadState()["settings"]), "gamePath"));
        if (!string.IsNullOrEmpty(saved) && File.Exists(saved)) return saved;
        string d = detectedGame;
        if (d != null && File.Exists(d)) return d;
        d = QuickFind();
        if (d != null) detectedGame = d;
        return d;
    }

    string QuickFind()
    {
        foreach (Process proc in Process.GetProcessesByName("AzerothSurvivors"))
            try { return proc.MainModule.FileName; } catch { }
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        List<string> dirs = new List<string> { exeDir, Path.GetDirectoryName(exeDir.TrimEnd('\\')) };
        foreach (string b in new[] { Path.Combine(home, "Downloads"), Environment.GetFolderPath(Environment.SpecialFolder.Desktop), Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), home, @"C:\Games", @"D:\Games" })
        {
            dirs.Add(Path.Combine(b, "AzerothSurvivors"));
            dirs.Add(Path.Combine(b, @"AzerothSurvivors\AzerothSurvivors"));
            dirs.Add(Path.Combine(b, "Azeroth Survivors"));
        }
        foreach (string dir in dirs)
            if (!string.IsNullOrEmpty(dir) && File.Exists(Path.Combine(dir, GameExe))) return Path.Combine(dir, GameExe);
        return null;
    }

    void FindGame()
    {
        if (GamePath() != null) return;
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        List<string> roots = new List<string> { home };
        foreach (DriveInfo dv in DriveInfo.GetDrives())
            try { if (dv.IsReady && dv.DriveType == DriveType.Fixed) roots.Add(dv.RootDirectory.FullName); } catch { }
        HashSet<string> skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Windows", "$Recycle.Bin", "System Volume Information", "AppData", "ProgramData", "node_modules", ".git", "WindowsApps", "Recovery", "PerfLogs", "$WinREAgent" };
        HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        int visited = 0;
        foreach (string root in roots)
        {
            Queue<KeyValuePair<string, int>> q = new Queue<KeyValuePair<string, int>>();
            q.Enqueue(new KeyValuePair<string, int>(root, 0));
            while (q.Count > 0 && visited < 300000)
            {
                KeyValuePair<string, int> cur = q.Dequeue();
                if (!seen.Add(cur.Key)) continue;
                visited++;
                string f = Path.Combine(cur.Key, GameExe);
                if (File.Exists(f))
                {
                    detectedGame = f;
                    Log("game found: " + f);
                    return;
                }
                if (cur.Value >= 5) continue;
                try
                {
                    foreach (string sub in Directory.GetDirectories(cur.Key))
                        if (!skip.Contains(Path.GetFileName(sub)) && (new DirectoryInfo(sub).Attributes & FileAttributes.ReparsePoint) == 0)
                            q.Enqueue(new KeyValuePair<string, int>(sub, cur.Value + 1));
                }
                catch { }
            }
        }
        Log("game not found after " + visited + " folders");
    }

    void FirstRunAddons()
    {
        string marker = Path.Combine(dataDir, "setup.json");
        if (File.Exists(marker) || running || remoteAddons.Count == 0 || GamePath() == null) return;
        string dir = AddonsDir();
        bool any = remoteAddons.Any(r => Directory.Exists(Path.Combine(dir, S(G(r, "name")) ?? "")));
        if (!any)
        {
            List<string> done = new List<string>();
            foreach (Dictionary<string, object> r in remoteAddons)
            {
                string name = S(G(r, "name")), err;
                try { err = AddonAction(name, "install"); } catch (Exception ex) { err = ex.Message; }
                if (string.IsNullOrEmpty(err)) done.Add(name); else Log("first install failed: " + name + ": " + err);
            }
            if (done.Count > 0) { addonsUpdated = string.Join(", ", done); addonsUpdatedAt = DateTime.Now; Log("addons installed on first run: " + addonsUpdated); }
        }
        File.WriteAllText(marker, "{\"addons\":true}");
    }

    static string GameLang()
    {
        string save = Environment.GetEnvironmentVariable("WOW_ROGUE_SAVE");
        string dir = !string.IsNullOrEmpty(save) ? Path.GetDirectoryName(save) : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "wenilla-rogue");
        string f = Path.Combine(dir, "language.txt");
        return File.Exists(f) ? File.ReadAllText(f).Trim() : "en";
    }

    Dictionary<string, object> LoadState()
    {
        string raw = File.Exists(stateFile) ? File.ReadAllText(stateFile, Utf8) : "{\"builds\":[],\"active\":{},\"settings\":{},\"nextId\":1}";
        Dictionary<string, object> s = D(json.DeserializeObject(raw)) ?? new Dictionary<string, object>();
        if (D(G(s, "settings")) == null) s["settings"] = new Dictionary<string, object>();
        if (G(s, "builds") == null) s["builds"] = new object[0];
        if (D(G(s, "active")) == null) s["active"] = new Dictionary<string, object>();
        return s;
    }

    string StateJson()
    {
        Dictionary<string, object> s = LoadState();
        Dictionary<string, object> st = D(s["settings"]);
        string saved = S(G(st, "gamePath"));
        if (string.IsNullOrEmpty(saved) || !File.Exists(saved)) st["gamePath"] = GamePath() ?? "";
        st["gameLang"] = GameLang();
        return json.Serialize(s);
    }

    static string LuaStr(string s)
    {
        return "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "") + "\"";
    }

    Dictionary<string, object> ActiveBuild(Dictionary<string, object> s, string classKey)
    {
        string id = S(G(G(s, "active"), classKey));
        return A(G(s, "builds")).Select(D).FirstOrDefault(b => S(G(b, "class")) == classKey && (id == null || S(G(b, "id")) == id));
    }

    string JewelName(Dictionary<string, object> c, string k)
    {
        if (k.StartsWith("leg:"))
        {
            string sk = k.Substring(4);
            object l = G(G(data, "legendaries"), sk);
            object d = A(G(c, "spells")).FirstOrDefault(x => S(G(x, "key")) == sk);
            return l != null && d != null ? Loc(G(l, "family")) + " : " + Loc(G(d, "name")) : k;
        }
        foreach (string cat in new[] { "rings", "trinkets", "amulets" })
            foreach (object j in A(G(data, cat)))
                if (S(G(j, "key")) == k) return Loc(G(j, "name"));
        foreach (object d in A(G(c, "spells")))
            if (S(G(d, "key")) == k) return Loc(G(d, "name"));
        return k;
    }

    Dictionary<string, double> measuredLuck = new Dictionary<string, double>();

    string savedFile;

    void ReadAddonRuns(string file)
    {
        if (file == null || !File.Exists(file)) return;
        string rf = Path.Combine(dataDir, "runs.json");
        if (!File.Exists(rf)) return;
        try
        {
            List<Dictionary<string, object>> runs = A(json.DeserializeObject(File.ReadAllText(rf, Utf8))).Select(D).ToList();
            System.Globalization.CultureInfo inv = System.Globalization.CultureInfo.InvariantCulture;
            int n = 0;
            foreach (Match m in Regex.Matches(File.ReadAllText(file, Utf8), "\"(AZR1\\|[^\"]*)\""))
            {
                string[] f = m.Groups[1].Value.Split('|');
                if (f.Length < 9) continue;
                double lvl = double.Parse(f[2], inv), kills = double.Parse(f[3], inv), total = double.Parse(f[6], inv);
                Dictionary<string, object> r = runs.LastOrDefault(x => x != null && G(x, "meter") == null && S(G(x, "class")) == f[1] && N(G(x, "level"), -1) == lvl && N(G(x, "kills"), -1) == kills);
                if (r == null || total <= 0) continue;
                List<object> meter = new List<object>();
                foreach (string line in f[7].Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    string[] l = line.Split(',');
                    if (l.Length >= 3) meter.Add(new Dictionary<string, object> { { "name", l[0] }, { "dmg", double.Parse(l[1], inv) }, { "proc", l[2] == "1" } });
                }
                Dictionary<string, object> stats = new Dictionary<string, object>();
                foreach (string kv in f[8].Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    int eq = kv.IndexOf('=');
                    double v;
                    if (eq > 0 && double.TryParse(kv.Substring(eq + 1), System.Globalization.NumberStyles.Float, inv, out v)) stats[kv.Substring(0, eq)] = v;
                }
                double time = N(G(r, "time"), 0);
                r["meter"] = meter;
                r["stats"] = stats;
                r["damageMeter"] = total;
                r["damage"] = Math.Round(total);
                r["dps"] = time > 0 ? Math.Round(total / time, 1) : 0;
                n++;
            }
            if (n == 0) return;
            File.WriteAllText(rf, json.Serialize(runs), Utf8);
            Log("addon meter merged into " + n + " run(s)");
        }
        catch (Exception ex) { Log("addon runs: " + ex.Message); }
    }

    void ReadLuck(string file)
    {
        if (!File.Exists(file)) return;
        Match block = Regex.Match(File.ReadAllText(file, Utf8), @"\[""luck""\]\s*=\s*\{([^}]*)\}|\bluck\s*=\s*\{([^}]*)\}");
        if (!block.Success) return;
        string body = block.Groups[1].Success ? block.Groups[1].Value : block.Groups[2].Value;
        foreach (Match m in Regex.Matches(body, @"\[?""?(\w+)""?\]?\s*=\s*([-\d.]+)"))
            measuredLuck[m.Groups[1].Value] = double.Parse(m.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture);
    }

    string[] JewelTarget(Dictionary<string, object> c, string cat, string k)
    {
        if (k.StartsWith("leg:"))
        {
            object l = G(G(data, "legendaries"), k.Substring(4));
            return new[] { JewelName(c, k), l != null ? Loc(G(l, "family")) : k, l != null ? S(G(l, "icon")) : "" };
        }
        object j = A(G(data, cat)).FirstOrDefault(x => S(G(x, "key")) == k);
        string n = j != null ? Loc(G(j, "name")) : k;
        return new[] { n, n, j != null ? S(G(j, "icon")) : "" };
    }

    void WriteGateway(Dictionary<string, object> s, string gameDir)
    {
        string home = Environment.GetEnvironmentVariable("BENILLA_HOME");
        string dir = Path.Combine(string.IsNullOrEmpty(home) ? Path.Combine(gameDir, "benilla-config") : home, "saved");
        Directory.CreateDirectory(dir);
        ReadLuck(Path.Combine(dir, "SurvivorsBuilds.lua"));
        ReadAddonRuns(Path.Combine(dir, "SurvivorsBuilds.lua"));
        AttachDetails(Path.Combine(dir, "SurvivorsBuilds.lua"));
        new Thread(FlushShare) { IsBackground = true }.Start();
        StringBuilder L = new StringBuilder();
        L.Append("SurvivorsBuildsDB = {\n  luck = { " + string.Join(", ", measuredLuck.Select(kv => kv.Key + " = " + kv.Value.ToString(System.Globalization.CultureInfo.InvariantCulture))) + " },\n  link = {\n");
        L.Append("    launched = " + (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds + ",\n");
        L.Append("    autoPick = " + (B(G(settings, "autoPick")) ? "true" : "false") + ",\n");
        L.Append("    lang = " + LuaStr(lang) + ",\n    builds = {\n");
        foreach (Dictionary<string, object> c in A(G(data, "classes")).Select(D))
        {
            string ck = S(c["key"]);
            Dictionary<string, object> b = ActiveBuild(s, ck) ?? ClassPresets(c).FirstOrDefault();
            if (b == null) continue;
            L.Append("      " + ck + " = ");
            BuildLua(L, c, b);
        }
        L.Append("    },\n    alts = {\n");
        foreach (Dictionary<string, object> c in A(G(data, "classes")).Select(D))
        {
            string ck = S(c["key"]);
            Dictionary<string, object> active = ActiveBuild(s, ck);
            Dictionary<int, Dictionary<string, object>> byTree = new Dictionary<int, Dictionary<string, object>>();
            foreach (Dictionary<string, object> b in A(G(s, "builds")).Select(D).Where(b => S(G(b, "class")) == ck))
            {
                int ti = SpecIndex(b, c);
                if (ti >= 0 && (!byTree.ContainsKey(ti) || b == active)) byTree[ti] = b;
            }
            Dictionary<string, int> caps = CapSpells(c);
            for (int t = 0; t < A(G(c, "trees")).Count(); t++)
                if (!byTree.ContainsKey(t))
                {
                    Dictionary<string, object> pb = PresetFor(c, t);
                    if (pb != null) byTree[t] = pb;
                }
            if (byTree.Count == 0) continue;
            L.Append("      " + ck + " = {\n        caps = { " + string.Join(", ", caps.Select(kv => kv.Key + " = " + (kv.Value + 1))) + " },\n");
            List<string> icons = new List<string>();
            int tn = 0;
            foreach (object tree in A(G(c, "trees")))
            {
                tn++;
                foreach (object t in A(G(tree, "talents")).Where(x => N(G(x, "row"), 0) == 6 && S(G(x, "icon")) != null))
                    icons.Add("[" + LuaStr(S(G(t, "icon")).ToLowerInvariant()) + "] = " + tn);
            }
            L.Append("        icons = { " + string.Join(", ", icons) + " },\n");
            foreach (KeyValuePair<int, Dictionary<string, object>> kv in byTree)
            {
                L.Append("        [" + (kv.Key + 1) + "] = ");
                BuildLua(L, c, kv.Value);
            }
            L.Append("      },\n");
        }
        L.Append("    },\n    all = {\n");
        foreach (Dictionary<string, object> c in A(G(data, "classes")).Select(D))
        {
            string ck = S(c["key"]);
            List<Dictionary<string, object>> mine = A(G(s, "builds")).Select(D).Where(b => S(G(b, "class")) == ck).ToList();
            if (mine.Count == 0) mine = ClassPresets(c);
            gatewayAll[ck] = mine;
            if (mine.Count < 2) continue;
            L.Append("      " + ck + " = {\n");
            foreach (Dictionary<string, object> b in mine)
            {
                L.Append("        ");
                BuildLua(L, c, b);
            }
            L.Append("      },\n");
        }
        L.Append("    },\n  },\n}\n");
        File.WriteAllText(Path.Combine(dir, "SurvivorsBuilds.lua"), L.ToString(), Utf8);
    }

    List<object> presets;

    List<Dictionary<string, object>> ClassPresets(Dictionary<string, object> c)
    {
        List<Dictionary<string, object>> list = new List<Dictionary<string, object>>();
        for (int t = 0; t < A(G(c, "trees")).Count(); t++)
        {
            Dictionary<string, object> pb = PresetFor(c, t);
            if (pb != null) list.Add(pb);
        }
        return list;
    }

    Dictionary<string, object> PresetFor(Dictionary<string, object> c, int tree)
    {
        if (presets == null)
        {
            byte[] raw = Resource("defaults.json");
            presets = raw == null ? new List<object>() : A(json.DeserializeObject(Utf8.GetString(raw))).ToList();
        }
        string ck = S(c["key"]);
        foreach (object p in presets.Where(x => S(G(x, "class")) == ck))
        {
            string[] f = (S(G(p, "code")) ?? "").Split(';');
            if (f.Length < 10) continue;
            Dictionary<string, object> b = new Dictionary<string, object>();
            b["class"] = ck;
            b["name"] = Loc(G(p, "names")) != "" ? Loc(G(p, "names")) : S(G(p, "name"));
            Dictionary<string, object> tal = new Dictionary<string, object>();
            string[] ranks = f[3].Split('/');
            int ti = 0;
            foreach (object t in A(G(c, "trees")))
            {
                List<object> list = A(G(t, "talents")).ToList();
                for (int i = 0; ti < ranks.Length && i < list.Count && i < ranks[ti].Length; i++)
                    if (ranks[ti][i] > '0') tal[S(G(list[i], "key"))] = ranks[ti][i] - '0';
                ti++;
            }
            b["talents"] = tal;
            if (SpecIndex(b, c) != tree) continue;
            b["spells"] = f[4].Split(',').Where(x => x != "").Select(x => (object)new Dictionary<string, object> { { "key", x.Split(':')[0] }, { "w", x.Contains(":") ? int.Parse(x.Split(':')[1]) : 3 } }).ToList();
            b["ban"] = f[5].Split(',').Where(x => x != "").ToDictionary(x => x, x => (object)true);
            b["rings"] = f[6].Split(',').Where(x => x != "").Select(x => (object)Regex.Replace(x, ":[1-5]$", "")).ToList();
            b["trinkets"] = f[7].Split(',').Where(x => x != "").Select(x => (object)Regex.Replace(x, ":[1-5]$", "")).ToList();
            b["amulets"] = f[8].Split(',').Where(x => x != "").Select(x => (object)Regex.Replace(x, ":[1-5]$", "")).ToList();
            string[] rv = f[9].Split(',');
            string[] rk = { "rarity", "reserve", "reroll", "banishes", "fallbackLevel", "boost", "adapt" };
            Dictionary<string, object> rules = new Dictionary<string, object>();
            for (int i = 0; i < rk.Length && i < rv.Length; i++) rules[rk[i]] = double.Parse(rv[i], System.Globalization.CultureInfo.InvariantCulture);
            b["rules"] = rules;
            return b;
        }
        return null;
    }

    void BuildLua(StringBuilder L, Dictionary<string, object> c, Dictionary<string, object> b)
    {
        Dictionary<string, object> rules = D(G(b, "rules")) ?? new Dictionary<string, object>();
        L.Append("{\n        name = " + LuaStr(S(G(b, "name"))) + ",\n        spells = {\n");
        foreach (object sp in A(G(b, "spells")))
        {
            object d = A(G(c, "spells")).FirstOrDefault(x => S(G(x, "key")) == S(G(sp, "key")));
            if (d != null) L.Append("          { key = " + LuaStr(S(G(sp, "key"))) + ", name = " + LuaStr(Loc(G(d, "name"))) + ", w = " + (int)N(G(sp, "w"), 3) + ", icon = " + LuaStr(S(G(d, "icon"))) + " },\n");
        }
        L.Append("        },\n        names = {\n");
        foreach (object d in A(G(c, "spells"))) L.Append("          " + S(G(d, "key")) + " = " + LuaStr(Loc(G(d, "name"))) + ",\n");
        L.Append("        },\n");
        Dictionary<string, object> ban = D(G(b, "ban")) ?? new Dictionary<string, object>();
        L.Append("        bans = { " + string.Join(", ", ban.Keys.Select(k => LuaStr(JewelName(c, k)))) + " },\n");
        List<string> jw = new List<string>();
        foreach (string cat in new[] { "rings", "trinkets", "amulets" })
        {
            object f = A(G(b, cat)).FirstOrDefault();
            if (f != null) jw.Add(LuaStr(JewelName(c, S(f))));
        }
        L.Append("        jewels = { " + string.Join(", ", jw) + " },\n");
        L.Append("        targets = {\n");
        foreach (string cat in new[] { "rings", "trinkets", "amulets" })
            foreach (object k in A(G(b, cat)).Take(cat == "amulets" ? 1 : 2))
            {
                string[] t = JewelTarget(c, cat, S(k));
                L.Append("          { cat = " + LuaStr(cat) + ", name = " + LuaStr(t[0]) + ", item = " + LuaStr(t[1]) + ", icon = " + LuaStr(t[2]) + " },\n");
            }
        L.Append("        },\n        fallbacks = {\n");
        foreach (string cat in new[] { "rings", "trinkets", "amulets" })
            foreach (object k in A(G(b, cat)).Skip(cat == "amulets" ? 1 : 2))
            {
                string[] t = JewelTarget(c, cat, S(k));
                L.Append("          { cat = " + LuaStr(cat) + ", name = " + LuaStr(t[0]) + ", item = " + LuaStr(t[1]) + ", icon = " + LuaStr(t[2]) + " },\n");
            }
        L.Append("        },\n        fallbackLevel = " + (int)N(G(rules, "fallbackLevel"), 10) + ",\n");
        Dictionary<string, object> tal = D(G(b, "talents")) ?? new Dictionary<string, object>();
        List<string> treeNames = new List<string>();
        L.Append("        talents = {\n");
        int ti = 0;
        foreach (object tree in A(G(c, "trees")))
        {
            treeNames.Add(LuaStr(Loc(G(tree, "name"))));
            foreach (object t in A(G(tree, "talents")))
            {
                int rank = (int)N(G(tal, S(G(t, "key"))), 0);
                if (rank > 0) L.Append("          { t = " + (ti + 1) + ", r = " + (int)N(G(t, "row"), 0) + ", c = " + (int)N(G(t, "col"), 0) + ", p = " + rank + ", m = " + (int)N(G(t, "max"), 1) + ", n = " + LuaStr(Loc(G(t, "name"))) + ", i = " + LuaStr(S(G(t, "icon"))) + " },\n");
            }
            ti++;
        }
        L.Append("        },\n        trees = { " + string.Join(", ", treeNames) + " },\n");
        L.Append("        reserve = " + (int)N(G(rules, "reserve"), 1) + ", banishes = " + (int)N(G(rules, "banishes"), 3) + ", reroll = " + (int)N(G(rules, "reroll"), 1) + ",\n      },\n");
    }

    void Launch()
    {
        Dictionary<string, object> s = LoadState();
        settings = D(s["settings"]);
        string path = GamePath();
        if (path == null) { error = GameLang().StartsWith("fr") ? "Jeu introuvable : indiquez où se trouve AzerothSurvivors.exe" : "Game not found: show where AzerothSurvivors.exe is"; return; }
        string l = S(G(settings, "lang"));
        lang = !string.IsNullOrEmpty(l) && l != "auto" ? l : GameLang().StartsWith("fr") ? "fr" : "en";
        string uiLang = lang;
        lang = GameLang().StartsWith("fr") ? "fr" : "en";
        try { WriteGateway(s, Path.GetDirectoryName(path)); }
        finally { lang = uiLang; }
        savedFile = Path.Combine(string.IsNullOrEmpty(Environment.GetEnvironmentVariable("BENILLA_HOME")) ? Path.Combine(Path.GetDirectoryName(path), "benilla-config") : Environment.GetEnvironmentVariable("BENILLA_HOME"), "saved", "SurvivorsBuilds.lua");
        string home = Environment.GetEnvironmentVariable("BENILLA_HOME");
        combatLog = Path.Combine(string.IsNullOrEmpty(home) ? Path.Combine(Path.GetDirectoryName(path), "benilla-config") : home, "Logs", "WoWCombatLog.txt");
        combatPos = File.Exists(combatLog) ? new FileInfo(combatLog).Length : 0;
        spellDmg = new Dictionary<string, double>();
        totalDmg = 0;
        ProcessStartInfo psi = new ProcessStartInfo(path);
        psi.WorkingDirectory = Path.GetDirectoryName(path);
        psi.UseShellExecute = false;
        psi.RedirectStandardOutput = true;
        psi.StandardOutputEncoding = Encoding.UTF8;
        game = Process.Start(psi);
        Process started = game;
        Thread reader = new Thread(delegate () { ReadGame(started); });
        reader.IsBackground = true;
        reader.Priority = ThreadPriority.AboveNormal;
        reader.Start();
        state = s;
        running = true;
        error = "";
        advice = "";
        Log("game started: " + path + ", autoPick=" + B(G(settings, "autoPick")));
    }

    static readonly string[] Noise = { "rogue: {\"type\":\"hz\"", "rogue: {\"type\":\"hzt\"", "rogue: {\"type\":\"hzend\"", "rogue: {\"type\":\"roster\"" };
    readonly object ioLock = new object();
    Dictionary<string, long[]> io = new Dictionary<string, long[]>();
    DateTime ioSince = DateTime.Now;

    void ReadGame(Process p)
    {
        try
        {
            using (StreamReader sr = new StreamReader(p.StandardOutput.BaseStream, new UTF8Encoding(false), false, 1 << 16))
            {
                string line;
                while ((line = sr.ReadLine()) != null)
                {
                    string kind = "other";
                    if (line.StartsWith("rogue: {\"type\":\""))
                    {
                        int e = line.IndexOf('"', 16);
                        kind = e > 16 ? line.Substring(16, e - 16) : "rogue";
                    }
                    lock (ioLock)
                    {
                        long[] c;
                        if (!io.TryGetValue(kind, out c)) io[kind] = c = new long[2];
                        c[0]++;
                        c[1] += line.Length + 1;
                    }
                    if (!line.StartsWith("rogue: {") || Noise.Any(line.StartsWith)) continue;
                    string l = line;
                    try { BeginInvoke((MethodInvoker)delegate { OnGameLine(l); }); } catch { }
                }
            }
        }
        catch (Exception ex) { Log("game output: " + ex.Message); }
    }

    void ResearchIo()
    {
        Dictionary<string, object> d = new Dictionary<string, object>();
        double secs;
        lock (ioLock)
        {
            secs = Math.Max(1, (DateTime.Now - ioSince).TotalSeconds);
            foreach (KeyValuePair<string, long[]> kv in io.OrderByDescending(kv => kv.Value[1]))
                d[kv.Key] = new Dictionary<string, object> { { "lines", kv.Value[0] }, { "bytes", kv.Value[1] } };
            io = new Dictionary<string, long[]>();
            ioSince = DateTime.Now;
        }
        Research("io", new Dictionary<string, object> { { "secs", Math.Round(secs) }, { "types", d } });
        Log("game output " + Math.Round(secs) + "s: " + string.Join(", ", d.Select(kv => kv.Key + " " + G(kv.Value, "lines"))));
    }

    void ShowAdvice(string text)
    {
        advice = text;
        if (replaying) return;
        overlay.Text2.Text = text;
        if (N(G(settings, "overlay"), 1) != 0 && !overlay.Visible) overlay.Show();
    }

    Dictionary<string, object> lastReady;

    void OnGameLine(string line)
    {
        if (!line.StartsWith("rogue: {")) return;
        Dictionary<string, object> j;
        try { j = D(json.DeserializeObject(line.Substring(7))); } catch { return; }
        if (j == null) return;
        string type = S(G(j, "type"));
        if (type == "ready")
        {
            if (G(j, "class") == null && lastReady != null)
                foreach (KeyValuePair<string, object> kv in lastReady)
                    if (!j.ContainsKey(kv.Key)) j[kv.Key] = kv.Value;
            if (G(j, "class") != null) lastReady = j;
            StartResearch(S(G(j, "class")));
        }
        if (type != "hz" && type != "hzend" && type != "hzt" && type != "roster") Research("game", j);
        if (type == "picked" || type == "resume" || type == "choices" || type == "defeat" || type == "victory" || type == "start") pendingKey = 0;
        if (type == "picked" || type == "resume") screenRerolls = 0;
        switch (type)
        {
            case "coop":
                coopSize = S(G(j, "state")) == "off" ? 0 : (int)N(G(j, "size"), 0);
                if (S(G(j, "role")) != "") coopRole = S(G(j, "role"));
                if (S(G(j, "code")) != "") coopCode = S(G(j, "code"));
                if (S(G(j, "state")) == "off" || S(G(j, "state")) == "ended" || S(G(j, "state")) == "left") { coopRole = null; coopCode = null; party = null; }
                break;
            case "party":
                party = A(G(j, "members")).Select(m => (object)new Dictionary<string, object> { { "classId", G(D(m), "classId") }, { "race", G(D(m), "race") }, { "host", B(G(D(m), "host")) }, { "me", B(G(D(m), "me")) } }).Take(5).ToList();
                break;
            case "downed":
                runDowned++;
                break;
            case "banner":
                if (S(G(j, "kind")) == "frienddown") runAllyDowned++;
                break;
            case "ready":
                runDowned = 0;
                runAllyDowned = 0;
                recordedIndex = -1;
                runStarted = DateTime.Now;
                runMinutes = new List<object>();
                runPicks = new List<object>();
                runCards = new List<object>();
                runLevel = 1;
                minuteDmg = 0;
                minuteTaken = 0;
                build = SelectBuild(S(G(j, "class")));
                ApplyGamePick();
                CapSignals();
                offeredNew = new HashSet<string>();
                owned = new Dictionary<string, int>();
                amulet = null;
                jewels = new Dictionary<string, string>();
                runLuck = 0;
                spellDmg = new Dictionary<string, double>();
                totalDmg = 0;
                hostiles = new HashSet<string>();
                jewelLuck = new Dictionary<string, double>();
                amuletLuck = 0;
                amuletUps = 0;
                if (build == null) ShowAdvice(lang == "fr" ? "Aucun build pour " + S(G(j, "class")) + " dans le compagnon" : "No build for " + S(G(j, "class")) + " in the companion");
                Log("hero " + S(G(j, "class")) + ", build " + S(G(build, "name")));
                Research("build", new Dictionary<string, object> { { "build", build }, { "measuredLuck", measuredLuck } });
                break;
            case "choices":
                runLevel = (int)N(G(j, "level"), runLevel);
                if (build == null) return;
                Advice a = Advise(j);
                if (a.Key == "r") screenRerolls++;
                ShowAdvice(a.Text);
                Log(S(G(j, "why")) + " lvl " + S(G(j, "level")) + ": " + a.Text);
                Research("advice", new Dictionary<string, object> { { "text", a.Text }, { "key", a.Key }, { "scores", lastScores }, { "luck", Math.Round(Luck(), 1) }, { "owned", owned }, { "amulet", amulet }, { "amuletUps", amuletUps } });
                if (B(G(settings, "autoPick")) && a.Key != null)
                {
                    uint vk = a.Key == "r" ? 0x52u : a.Key == "x" ? 0x58u : (uint)(0x30 + int.Parse(a.Key));
                    System.Windows.Forms.Timer t = new System.Windows.Forms.Timer { Interval = (DateTime.Now - lastKey).TotalMilliseconds < 2500 ? 600 : 500 };
                    lastKey = DateTime.Now;
                    t.Tick += delegate
                    {
                        t.Stop();
                        t.Dispose();
                        if (!running) return;
                        pendingKey = vk;
                        pendingTries = 0;
                        SendKey(vk);
                        Log("sent key " + a.Key);
                        if (a.Pick != null && S(G(a.Pick, "replaces")) != null)
                        {
                            System.Windows.Forms.Timer c = new System.Windows.Forms.Timer { Interval = 400 };
                            c.Tick += delegate
                            {
                                c.Stop();
                                c.Dispose();
                                if (!running || pendingKey != vk) return;
                                pendingKey = 0x0D;
                                pendingTries = 0;
                                SendKey(0x0D);
                                Log("sent Enter (replace amulet)");
                            };
                            c.Start();
                        }
                    };
                    t.Start();
                    if (a.Pick != null) Took(a.Pick);
                }
                break;
            case "resume":
            case "start":
                if (build != null) overlay.Hide();
                break;
            case "heroic":
                MarkHeroic((int)N(G(j, "level"), 0));
                break;
            case "defeat":
            case "victory":
                if (build != null) overlay.Hide();
                try { RecordRun(j); } catch (Exception ex) { Log("stats error: " + ex.Message); }
                break;
        }
    }

    void Took(object card)
    {
        CardInfo info = Info(card);
        runPicks.Add(new Dictionary<string, object> { { "t", Math.Round((DateTime.Now - runStarted).TotalSeconds) }, { "took", info.Key }, { "kind", S(G(card, "kind")) }, { "rarity", N(G(card, "rarity"), 0) } });
        if (info.Type == "spell" && info.Key != null) owned[info.Key] = (int)N(G(card, "rank"), 1);
        if (info.Cat == "amulets" && info.Key != null) { amuletUps = info.Key == amulet ? amuletUps + 1 : 0; amulet = info.Key; }
        if (info.Type == "jewel" && info.Key != null && info.Cat != "amulets") jewels[info.Key] = info.Cat;
        if (info.Type == "jewel")
        {
            double cl = CardLuck(card);
            if (info.Cat == "amulets") amuletLuck = cl;
            else if (info.Key != null) { jewelLuck[info.Key] = cl; runLuck = jewelLuck.Values.Sum(); }
            Log("took " + S(G(card, "title")) + " (" + S(G(card, "rarityName")) + "): " + (S(G(card, "lines")) ?? "").Replace("\n", " / "));
        }
    }

    static double CardLuck(object card)
    {
        Match m = Regex.Match((S(G(card, "lines")) ?? "") + " " + (S(G(card, "text")) ?? ""), @"(?:\+?[\d.,]+\s*%\s*»\s*)?\+?([\d.,]+)\s*%\s*(de chance|luck)");
        return m.Success ? double.Parse(m.Groups[1].Value.Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture) : 0;
    }

    Dictionary<string, object> SelectBuild(string cls)
    {
        heroClass = A(G(data, "classes")).Select(D).FirstOrDefault(c => S(c["key"]) == cls || S(G(c["name"], "en")) == cls || S(G(c["name"], "fr")) == cls);
        return heroClass == null ? null : ActiveBuild(state, S(heroClass["key"])) ?? ClassPresets(heroClass).FirstOrDefault();
    }

    class CardInfo { public string Type, Cat, Key, Spell; }

    CardInfo Info(object card)
    {
        string kind = S(G(card, "kind")), icon = S(G(card, "icon")), name = S(G(card, "name")), title = S(G(card, "title")) ?? "";
        if (kind == "new" || kind == "upgrade")
        {
            foreach (object s in A(G(heroClass, "spells")))
                if (S(G(s, "icon")) == icon || S(G(G(s, "name"), "en")) == name || S(G(G(s, "name"), "fr")) == name)
                    return new CardInfo { Type = "spell", Key = S(G(s, "key")) };
            return new CardInfo { Type = "spell" };
        }
        string cat = kind == "ring" ? "rings" : kind == "trinket" ? "trinkets" : "amulets";
        foreach (object s in A(G(heroClass, "spells")))
        {
            string sk = S(G(s, "key"));
            object leg = G(G(data, "legendaries"), sk);
            if (leg != null && icon == S(G(leg, "icon")) && (title.Contains(S(G(G(s, "name"), "fr"))) || title.Contains(S(G(G(s, "name"), "en")))))
                return new CardInfo { Type = "jewel", Cat = "amulets", Key = "leg:" + sk, Spell = sk };
        }
        if (cat == "amulets" && amulet != null && amulet.StartsWith("leg:"))
        {
            object worn = G(G(data, "legendaries"), amulet.Substring(4));
            if (worn != null && icon == S(G(worn, "icon"))) return new CardInfo { Type = "jewel", Cat = "amulets", Key = amulet, Spell = amulet.Substring(4) };
        }
        foreach (object jw in A(G(data, cat)))
            if (S(G(jw, "icon")) == icon || S(G(G(jw, "name"), "en")) == name || S(G(G(jw, "name"), "fr")) == name)
                return new CardInfo { Type = "jewel", Cat = cat, Key = S(G(jw, "key")) };
        return new CardInfo { Type = "jewel", Cat = cat };
    }

    double JewelLuck(string cat, string key)
    {
        object jw = A(G(data, cat)).FirstOrDefault(x => S(G(x, "key")) == key);
        double sum = 0;
        foreach (object line in A(G(G(jw, "desc"), "en")))
        {
            Match m = Regex.Match(S(line), @"^\+([\d.]+)% luck$");
            if (m.Success) sum += double.Parse(m.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
        }
        return sum;
    }

    double Luck()
    {
        double l = runLuck, measured;
        if (heroClass != null && measuredLuck.TryGetValue(S(heroClass["key"]), out measured)) l += measured;
        else
        {
            Dictionary<string, object> tal = D(G(build, "talents"));
            foreach (object tree in A(G(heroClass, "trees")))
                foreach (object t in A(G(tree, "talents")))
                    if (Regex.IsMatch(S(G(G(t, "desc"), "en")) ?? "", "your luck by \\{v\\}%") && tal != null && tal.ContainsKey(S(G(t, "key"))))
                        l += N(G(t, "v"), 0) * N(tal[S(G(t, "key"))], 0);
        }
        l += amuletLuck;
        return l;
    }

    double ExpectedRarity(double luck, double infl)
    {
        double total = 0, sum = 0;
        for (int r = 0; r < 5; r++)
        {
            double w = BaseOdds[r] * Math.Pow(1 + luck / 100, r);
            total += w;
            sum += w * (1 + infl * r);
        }
        return sum / total;
    }

    double Boost() { return N(G(G(build, "rules"), "boost"), 2); }


    int recordedIndex = -1;
    int detectedTree = -1;
    HashSet<string> offeredNew = new HashSet<string>();
    string specNote = "";
    Dictionary<string, int> capSpells = new Dictionary<string, int>(), capPets = new Dictionary<string, int>();
    static readonly Dictionary<string, string[]> CapPets = new Dictionary<string, string[]>
    {
        { "raptor", new[] { "Raptor" } },
        { "treants", new[] { "Tréant", "Treant" } },
        { "Water Elemental", new[] { "Élémentaire d'eau", "Water Elemental" } },
        { "spirit wolves", new[] { "Loup spirituel", "Esprit du loup", "Spirit Wolf" } },
        { "Pit Lord", new[] { "Seigneur des fosses", "Pit Lord", "Seigneur de l'effroi", "Dread Lord" } },
        { "Dread Lord", new[] { "Seigneur de l'effroi", "Dread Lord" } },
        { "Felguard", new[] { "Gangregarde", "Felguard" } },
    };

    int SpecIndex(Dictionary<string, object> b)
    {
        return SpecIndex(b, heroClass);
    }

    int SpecIndex(Dictionary<string, object> b, Dictionary<string, object> cls)
    {
        Dictionary<string, object> tal = D(G(b, "talents"));
        if (cls == null || tal == null) return -1;
        double best = 0;
        int found = -1, ti = 0;
        foreach (object tree in A(G(cls, "trees")))
        {
            double pts = A(G(tree, "talents")).Sum(t => tal.ContainsKey(S(G(t, "key"))) ? N(tal[S(G(t, "key"))], 0) : 0);
            if (pts > best) { best = pts; found = ti; }
            ti++;
        }
        return found;
    }

    Dictionary<string, int> CapSpells(Dictionary<string, object> cls)
    {
        Dictionary<string, int> caps = new Dictionary<string, int>();
        if (cls == null) return caps;
        int ti = 0;
        foreach (object tree in A(G(cls, "trees")))
        {
            foreach (object t in A(G(tree, "talents")))
            {
                // Rockbiter ne s'obtient que par ce palier : seul signe de la spé Amélioration, dont l'apogée n'a pas de sort de départ
                if (N(G(t, "row"), 0) != 6 && S(G(t, "key")) != "rockbiter_initiation") continue;
                Match m = Regex.Match(S(G(G(t, "desc"), "en")) ?? "", @"[Ss]tart (?:every|each) run with (.+?)(?: instead of|[,;.]| and )");
                if (m.Success)
                    foreach (object sp in A(G(cls, "spells")))
                        if (S(G(G(sp, "name"), "en")) == m.Groups[1].Value.Trim()) caps[S(G(sp, "key"))] = ti;
            }
            ti++;
        }
        return caps;
    }

    void CapSignals()
    {
        capPets = new Dictionary<string, int>();
        detectedTree = -1;
        specNote = "";
        capSpells = CapSpells(heroClass);
        if (heroClass == null) return;
        int ti = 0;
        foreach (object tree in A(G(heroClass, "trees")))
        {
            foreach (object t in A(G(tree, "talents")))
            {
                if (N(G(t, "row"), 0) != 6) continue;
                string desc = S(G(G(t, "desc"), "en")) ?? "";
                foreach (KeyValuePair<string, string[]> pet in CapPets)
                    if (desc.IndexOf(pet.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                        foreach (string n in pet.Value) capPets[n] = ti;
            }
            ti++;
        }
    }

    void DetectSpec(int tree, string why)
    {
        if (detectedTree >= 0 || heroClass == null) return;
        if (gamePick > 0) { detectedTree = tree; Log("spec detected (" + why + ") but the build was chosen in game"); return; }
        detectedTree = tree;
        bool fr = lang == "fr";
        object t = A(G(heroClass, "trees")).ElementAtOrDefault(tree);
        string treeName = S(G(G(t, "name"), fr ? "fr" : "en")) ?? S(G(G(t, "name"), "en"));
        string cls = S(heroClass["key"]);
        Dictionary<string, object> pick = SpecIndex(build) == tree ? build : A(G(state, "builds")).Select(D).FirstOrDefault(b => S(G(b, "class")) == cls && SpecIndex(b) == tree) ?? PresetFor(heroClass, tree);
        if (pick == null) specNote = fr ? "Spé détectée : " + treeName + ", aucun build de cette spé, « " + S(G(build, "name")) + " » gardé" : "Spec detected: " + treeName + ", no build for it, keeping \"" + S(G(build, "name")) + "\"";
        else
        {
            if (pick != build) build = pick;
            specNote = fr ? "Spé détectée : " + treeName + ", build « " + S(G(build, "name")) + " »" : "Spec detected: " + treeName + ", build \"" + S(G(build, "name")) + "\"";
        }
        Log("spec detected (" + why + "): " + treeName + ", build " + S(G(build, "name")));
        Research("spec", new Dictionary<string, object> { { "tree", tree }, { "why", why }, { "build", build } });
    }
    int coopSize, runDowned, runAllyDowned;
    string coopRole, coopCode;
    List<object> party;
    double victoryTime;

    DateTime runStarted = DateTime.Now;
    List<object> runMinutes = new List<object>();
    List<object> runPicks = new List<object>();
    List<object> runCards = new List<object>();
    int runLevel = 1;
    double minuteDmg, minuteTaken;
    readonly object shareLock = new object();

    string BuildCode(Dictionary<string, object> b)
    {
        if (b == null || heroClass == null) return null;
        Dictionary<string, object> tal = D(G(b, "talents")) ?? new Dictionary<string, object>();
        string trees = string.Join("/", A(G(heroClass, "trees")).Select(t => string.Concat(A(G(t, "talents")).Select(x => ((int)N(G(tal, S(G(x, "key"))), 0)).ToString()))));
        Dictionary<string, object> rules = D(G(b, "rules")) ?? new Dictionary<string, object>();
        string[] rk = { "rarity", "reserve", "reroll", "banishes", "fallbackLevel", "boost", "adapt" };
        double[] rd = { 50, 1, 1, 3, 10, 2, 1 };
        return string.Join(";", new[] {
            "SB1", S(heroClass["key"]), (S(G(b, "name")) ?? "").Replace(";", ","), trees,
            string.Join(",", A(G(b, "spells")).Select(x => S(G(x, "key")) + ":" + (int)N(G(x, "w"), 3))),
            string.Join(",", (D(G(b, "ban")) ?? new Dictionary<string, object>()).Keys.OrderBy(k => k)),
            string.Join(",", A(G(b, "rings")).Select(S)), string.Join(",", A(G(b, "trinkets")).Select(S)), string.Join(",", A(G(b, "amulets")).Select(S)),
            string.Join(",", rk.Select((k, i) => N(G(rules, k), rd[i]).ToString(System.Globalization.CultureInfo.InvariantCulture))) });
    }

    const string DefaultShareUrl = "https://as-stats.zkysolutions.com";

    string ShareUrl()
    {
        string u = Environment.GetEnvironmentVariable("AS_COMPANION_SHARE_URL");
        return string.IsNullOrEmpty(u) ? DefaultShareUrl : u;
    }

    readonly Dictionary<string, KeyValuePair<DateTime, byte[]>> communityCache = new Dictionary<string, KeyValuePair<DateTime, byte[]>>();

    byte[] CommunityGet(string route, int seconds)
    {
        lock (communityCache)
        {
            KeyValuePair<DateTime, byte[]> hit;
            if (communityCache.TryGetValue(route, out hit) && DateTime.Now < hit.Key) return hit.Value;
            try
            {
                byte[] body;
                using (WebClient w = Web()) body = w.DownloadData(ShareUrl().TrimEnd('/') + route);
                communityCache[route] = new KeyValuePair<DateTime, byte[]>(DateTime.Now.AddSeconds(seconds), body);
                return body;
            }
            catch (Exception ex) { Log("community " + route + ": " + ex.Message); return communityCache.TryGetValue(route, out hit) ? hit.Value : null; }
        }
    }

    string InstallId()
    {
        string f = Path.Combine(dataDir, "install-id.txt");
        if (File.Exists(f)) return File.ReadAllText(f).Trim();
        string id = Guid.NewGuid().ToString();
        File.WriteAllText(f, id);
        return id;
    }

    void QueueShare(Dictionary<string, object> r)
    {
        try
        {
            if (N(G(settings, "shareRuns"), 1) == 0 || heroClass == null) return;
            string install = InstallId();
            double total = spellDmg.Values.Sum();
            Dictionary<string, object> run = new Dictionary<string, object> {
                { "v", 1 }, { "runId", Guid.NewGuid().ToString("N").Substring(0, 16) }, { "client", CurrentVersion }, { "install", install }, { "startedAt", runStarted.ToUniversalTime().ToString("o") }, { "endedAt", DateTime.UtcNow.ToString("o") },
                { "class", S(heroClass["key"]) }, { "race", G(r, "race") }, { "spec", G(r, "spec") },
                { "zone", G(r, "bg") }, { "difficulty", null }, { "coop", coopSize > 1 ? coopSize : 1 },
                { "result", G(r, "result") }, { "time", G(r, "time") }, { "level", G(r, "level") }, { "kills", G(r, "kills") },
                { "dps", G(r, "dps") }, { "damage", G(r, "damage") }, { "taken", G(r, "taken") },
                { "build", BuildCode(build) },
                { "minutes", runMinutes },
                { "spells", spellDmg.ToDictionary(kv => kv.Key, kv => (object)new Dictionary<string, object> { { "rank", owned.ContainsKey(kv.Key) ? owned[kv.Key] : 0 }, { "share", total > 0 ? Math.Round(kv.Value / total, 4) : 0 } }) },
                { "jewels", G(r, "jewels") }, { "amuletUps", amuletUps },
                { "picks", runPicks }, { "downed", runDowned }
            };
            if (coopSize > 1)
            {
                run["role"] = coopRole;
                run["allyDowned"] = runAllyDowned;
                if (party != null) run["party"] = party;
                if (coopCode != null)
                    using (System.Security.Cryptography.SHA256 sha = System.Security.Cryptography.SHA256.Create())
                        run["group"] = BitConverter.ToString(sha.ComputeHash(Utf8.GetBytes(coopCode + "|" + G(r, "bg")))).Replace("-", "").Substring(0, 16).ToLowerInvariant();
            }
            lock (shareLock)
            {
                string qf = Path.Combine(dataDir, "share-queue.json");
                List<object> q = File.Exists(qf) ? A(json.DeserializeObject(File.ReadAllText(qf, Utf8))).ToList() : new List<object>();
                q.Add(run);
                if (runCards.Count > 0)
                    q.Add(new Dictionary<string, object> { { "v", 1 }, { "kind", "cards" }, { "install", install }, { "class", S(heroClass["key"]) }, { "cards", runCards.Take(40).ToList() } });
                while (q.Count > 200) q.RemoveAt(0);
                File.WriteAllText(qf, json.Serialize(q), Utf8);
            }
        }
        catch (Exception ex) { Log("share queue failed: " + ex.Message); }
    }

    bool DetailMatches(string[] f, Dictionary<string, object> run)
    {
        System.Globalization.CultureInfo inv = System.Globalization.CultureInfo.InvariantCulture;
        double level = double.Parse(f[3], inv), kills = double.Parse(f[4], inv), time = double.Parse(f[5], inv), runKills = N(G(run, "kills"), -1), runTime = N(G(run, "time"), -1);
        if (f[1].Split(',')[0] != S(G(run, "class")) || Math.Abs(level - N(G(run, "level"), -1)) >= 1.5) return false;
        if (runTime < 0) return Math.Abs(kills - runKills) <= 5 + 0.05 * runKills;
        return Math.Abs(time - runTime) <= 3 || (kills == runKills && kills >= 50);
    }

    string[] TakeDetail(List<string[]> details, Dictionary<string, object> run)
    {
        string[] d = details.LastOrDefault(f => DetailMatches(f, run));
        if (d != null) details.Remove(d);
        return d;
    }

    void AttachDetails(string file)
    {
        if (file == null || !File.Exists(file)) return;
        try
        {
            List<string[]> details = Regex.Matches(File.ReadAllText(file, Utf8), "\"(AZD1\\|[^\"]*)\"").Cast<Match>().Select(m => m.Groups[1].Value.Split('|')).Where(f => f.Length >= 15).ToList();
            if (details.Count == 0) return;
            string rf = Path.Combine(dataDir, "runs.json");
            if (File.Exists(rf))
            {
                List<object> runs = A(json.DeserializeObject(File.ReadAllText(rf, Utf8))).ToList();
                int marked = 0;
                foreach (string[] d in details)
                {
                    string[] head = d[1].Split(',');
                    int hl;
                    if (head.Length < 4 || !int.TryParse(head[3], out hl) || hl <= 0) continue;
                    Dictionary<string, object> run = runs.Select(D).LastOrDefault(x => x != null && G(x, "heroic") == null && DetailMatches(d, x));
                    if (run == null) continue;
                    run["heroic"] = hl;
                    marked++;
                }
                if (marked > 0) File.WriteAllText(rf, json.Serialize(runs), Utf8);
            }
            lock (shareLock)
            {
                string qf = Path.Combine(dataDir, "share-queue.json");
                List<object> q = File.Exists(qf) ? A(json.DeserializeObject(File.ReadAllText(qf, Utf8))).ToList() : new List<object>();
                int n = 0;
                foreach (object o in q)
                {
                    Dictionary<string, object> run = D(o);
                    if (run == null || G(run, "detail") != null) continue;
                    string[] d = TakeDetail(details, run);
                    if (d == null) continue;
                    run["detail"] = string.Join("|", d);
                    int hl;
                    string[] head = d[1].Split(',');
                    if (G(run, "difficulty") == null && head.Length > 3 && int.TryParse(head[3], out hl)) run["difficulty"] = hl;
                    n++;
                }
                string sf = Path.Combine(dataDir, "share-sent.json");
                List<object> sentRuns = File.Exists(sf) ? A(json.DeserializeObject(File.ReadAllText(sf, Utf8))).ToList() : new List<object>();
                foreach (object o in sentRuns.ToList())
                {
                    Dictionary<string, object> run = D(o);
                    if (run == null) continue;
                    string[] d = TakeDetail(details, run);
                    if (d == null) continue;
                    q.Add(new Dictionary<string, object> { { "v", 1 }, { "kind", "detail" }, { "install", InstallId() }, { "runId", G(run, "runId") }, { "class", G(run, "class") }, { "level", G(run, "level") }, { "kills", G(run, "kills") }, { "detail", string.Join("|", d) } });
                    sentRuns.Remove(o);
                    n++;
                }
                if (n > 0) { File.WriteAllText(qf, json.Serialize(q), Utf8); File.WriteAllText(sf, json.Serialize(sentRuns), Utf8); Log("run details attached: " + n); }
            }
        }
        catch (Exception ex) { Log("details failed: " + ex.Message); }
    }

    void FlushShare()
    {
        string url = ShareUrl();
        if (N(G(settings, "shareRuns"), 1) == 0) return;
        lock (shareLock)
        {
            string qf = Path.Combine(dataDir, "share-queue.json");
            if (!File.Exists(qf)) return;
            List<object> q = A(json.DeserializeObject(File.ReadAllText(qf, Utf8))).ToList();
            int sent = 0;
            string sf = Path.Combine(dataDir, "share-sent.json");
            List<object> sentRuns = File.Exists(sf) ? A(json.DeserializeObject(File.ReadAllText(sf, Utf8))).ToList() : new List<object>();
            while (q.Count > 0)
            {
                try
                {
                    using (WebClient w = Web())
                    {
                        w.Headers.Add("Content-Type", "application/json");
                        w.Headers.Add("Content-Encoding", "gzip");
                        MemoryStream ms = new MemoryStream();
                        using (System.IO.Compression.GZipStream gz = new System.IO.Compression.GZipStream(ms, System.IO.Compression.CompressionMode.Compress, true))
                        {
                            byte[] raw = Utf8.GetBytes(json.Serialize(q[0]));
                            gz.Write(raw, 0, raw.Length);
                        }
                        string kind = S(G(D(q[0]), "kind"));
                        string route = kind == "detail" ? "/api/details" : kind == "cards" ? "/api/cards" : "/api/runs";
                        w.UploadData(url.TrimEnd('/') + route, "POST", ms.ToArray());
                        if (kind != "detail" && kind != "cards" && G(D(q[0]), "detail") == null && G(D(q[0]), "runId") != null)
                            sentRuns.Add(new Dictionary<string, object> { { "runId", G(D(q[0]), "runId") }, { "class", G(D(q[0]), "class") }, { "level", G(D(q[0]), "level") }, { "kills", G(D(q[0]), "kills") }, { "time", G(D(q[0]), "time") } });
                    }
                    q.RemoveAt(0);
                    sent++;
                }
                catch (Exception ex)
                {
                    WebException we = ex as WebException;
                    HttpWebResponse rsp = we == null ? null : we.Response as HttpWebResponse;
                    int code = rsp == null ? 0 : (int)rsp.StatusCode;
                    if (code >= 400 && code < 500 && code != 429) { Log("share rejected: " + ex.Message); q.RemoveAt(0); continue; }
                    Log("share failed: " + ex.Message);
                    break;
                }
            }
            File.WriteAllText(qf, json.Serialize(q), Utf8);
            while (sentRuns.Count > 100) sentRuns.RemoveAt(0);
            File.WriteAllText(sf, json.Serialize(sentRuns), Utf8);
            if (sent > 0) Log("shared runs: " + sent);
        }
    }

    void MarkHeroic(int level)
    {
        try
        {
            string rf = Path.Combine(dataDir, "runs.json");
            if (recordedIndex < 0 || !File.Exists(rf)) return;
            List<object> runs = A(json.DeserializeObject(File.ReadAllText(rf, Utf8))).ToList();
            if (recordedIndex >= runs.Count) return;
            D(runs[recordedIndex])["heroic"] = level;
            File.WriteAllText(rf, json.Serialize(runs), Utf8);
            lock (shareLock)
            {
                string qf = Path.Combine(dataDir, "share-queue.json");
                if (File.Exists(qf))
                {
                    List<object> q = A(json.DeserializeObject(File.ReadAllText(qf, Utf8))).ToList();
                    Dictionary<string, object> last = q.Select(D).LastOrDefault(x => x != null && S(G(x, "kind")) != "detail" && S(G(x, "kind")) != "cards");
                    if (last != null) { last["difficulty"] = level; File.WriteAllText(qf, json.Serialize(q), Utf8); }
                }
            }
            Log("heroic " + level + " beaten");
        }
        catch (Exception ex) { Log("heroic mark failed: " + ex.Message); }
    }

    void RecordRun(Dictionary<string, object> j)
    {
        ReadCombat();
        string rf = Path.Combine(dataDir, "runs.json");
        List<object> runs = File.Exists(rf) ? A(json.DeserializeObject(File.ReadAllText(rf, Utf8))).ToList() : new List<object>();
        Dictionary<string, object> r = new Dictionary<string, object>();
        foreach (string k in new[] { "time", "level", "kills", "elites", "guardians", "bosses", "damage", "taken", "gold", "chests", "hero", "race", "bg" })
            r[k] = G(j, k);
        r["result"] = S(G(j, "type"));
        r["left"] = G(j, "left");
        r["date"] = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        r["class"] = heroClass != null ? S(heroClass["key"]) : S(G(j, "class"));
        r["build"] = S(G(build, "name"));
        int specTree = detectedTree >= 0 ? detectedTree : SpecIndex(build);
        r["spec"] = specTree >= 0 && heroClass != null ? S(heroClass["key"]) + "-" + specTree : null;
        if (detectedTree >= 0) r["specDetected"] = true;
        if (coopSize > 1) r["coop"] = coopSize;
        r["downed"] = runDowned;
        double time = N(G(j, "time"), 0);
        r["damageGame"] = G(j, "damage");
        r["damageLog"] = Math.Round(totalDmg);
        double pets;
        spellDmg.TryGetValue("Pets", out pets);
        r["damagePets"] = Math.Round(pets);
        if (N(r["damage"], 0) > 0) r["damage"] = Math.Round(N(r["damage"], 0) + pets);
        else if (totalDmg > 0) r["damage"] = Math.Round(totalDmg);
        r["dps"] = time > 0 ? Math.Round(N(r["damage"], 0) / time, 1) : 0;
        r["spells"] = owned.ToDictionary(kv => kv.Key, kv => (object)kv.Value);
        r["jewels"] = jewels.Keys.Concat(amulet != null ? new[] { amulet } : new string[0]).ToArray();
        r["luck"] = Math.Round(Luck());
        r["dmg"] = spellDmg.OrderByDescending(kv => kv.Value).ToDictionary(kv => kv.Key, kv => (object)Math.Round(kv.Value));
        if (recordedIndex >= 0 && recordedIndex < runs.Count && S(G(runs[recordedIndex], "result")) == "victory")
        {
            r["result"] = "victory";
            r["endless"] = true;
            r["endlessTime"] = Math.Round(time - victoryTime, 1);
            runs[recordedIndex] = r;
        }
        else
        {
            runs.Add(r);
            recordedIndex = runs.Count - 1;
            if (S(r["result"]) == "victory") victoryTime = time;
        }
        File.WriteAllText(rf, json.Serialize(runs), Utf8);
        ResearchCombat();
        Research("run", r);
        if (!r.ContainsKey("endless"))
        {
            QueueShare(r);
            new Thread(() => { Thread.Sleep(15000); FlushShare(); }) { IsBackground = true }.Start();
        }
        Log("run recorded: " + r["result"] + " lvl " + r["level"] + " " + Math.Round(time) + "s dps " + r["dps"]);
    }

    double BuildWeight(string key)
    {
        List<object> sp = A(G(build, "spells")).ToList();
        int i = sp.FindIndex(x => S(G(x, "key")) == key);
        return i < 0 ? 0 : N(G(sp[i], "w"), 3) * (i >= 6 ? 0.5 : 1);
    }

    double JewelWeight(string cat, string key)
    {
        List<string> list = A(G(build, cat)).Select(S).ToList();
        int idx = list.IndexOf(key);
        double set = N(G(G(build, "jw"), key), 0);
        double w = idx >= 0 ? (set > 0 ? set : idx < (cat == "amulets" ? 1 : 2) ? 5 : 3) * 2 : 0;
        if (key.StartsWith("leg:"))
        {
            string sk = key.Substring(4);
            double bw = BuildWeight(sk);
            if (idx >= 0 || bw >= 4) w = Math.Max(w, bw * Boost()) * (bw >= 4 ? Math.Max(1, DmgFactor(sk)) : DmgFactor(sk));
        }
        return w;
    }

    static int JewelRank(string title)
    {
        Match m = Regex.Match(title ?? "", @"\s([IVX]+)(\+?)$");
        if (!m.Success) return 1;
        int n = 0, prev = 0;
        string v = m.Groups[1].Value;
        for (int i = v.Length - 1; i >= 0; i--)
        {
            int d = v[i] == 'X' ? 10 : v[i] == 'V' ? 5 : 1;
            n += d < prev ? -d : d;
            prev = Math.Max(prev, d);
        }
        return n + (m.Groups[2].Value == "+" ? 1 : 0);
    }

    double SpellWeight(string key)
    {
        double w = 0;
        int i = 0, at = -1;
        foreach (object s in A(G(build, "spells")))
        {
            if (S(G(s, "key")) == key) { w = N(G(s, "w"), 3); at = i; if (i >= 6) w *= 0.5; }
            i++;
        }
        if (N(G(G(build, "rules"), "adapt"), 1) != 0)
        {
            if (owned.ContainsKey(key)) w = Math.Max(w, 1) * 1.25 * (at >= 0 && at < 6 ? Math.Max(0.6, DmgFactor(key)) : DmgFactor(key));
            if (amulet == "leg:" + key) w = Math.Max(w, 2) * Boost();
        }
        return w;
    }

    class Advice { public string Text, Key; public object Pick; }

    Advice Advise(Dictionary<string, object> j)
    {
        Dictionary<string, object> rules = D(G(build, "rules")) ?? new Dictionary<string, object>();
        Dictionary<string, object> ban = D(G(build, "ban")) ?? new Dictionary<string, object>();
        double infl = N(G(rules, "rarity"), 50) / 100;
        int lvl = (int)N(G(j, "level"), 1);
        int rerolls = (int)N(G(j, "rerolls"), 0), reserve = (int)N(G(rules, "reserve"), 1);
        bool jewelScreen = S(G(j, "why")) != "levelup";
        bool reroll = N(G(rules, "reroll"), 1) == 1 && !(jewelScreen && lvl < N(G(rules, "fallbackLevel"), 10) && screenRerolls >= 2);
        bool fr = lang == "fr";
        List<object> cards = A(G(j, "choices")).ToList();
        List<string> scores = new List<string>();
        int best = 0, banIdx = 0;
        double bestScore = 0;
        bool bestTarget = false;
        for (int i = 1; i <= cards.Count; i++)
        {
            object card = cards[i - 1];
            CardInfo info = Info(card);
            if (info.Type == "spell" && info.Key != null && (S(G(card, "kind")) == "new" || S(G(card, "kind")) == "upgrade"))
                runCards.Add(new Dictionary<string, object> { { "name", S(G(card, "name")) ?? info.Key }, { "kind", S(G(card, "kind")) }, { "lines", S(G(card, "lines")) }, { "rarity", N(G(card, "rarity"), 0) }, { "title", S(G(card, "title")) } });
            string replIcon = S(G(card, "replacesIcon")), replText = S(G(card, "replacesText")) ?? "";
            if (replIcon != null && info.Cat == "amulets")
            {
                foreach (object a in A(G(data, "amulets"))) if (S(G(a, "icon")) == replIcon) amulet = S(G(a, "key"));
                foreach (object s in A(G(heroClass, "spells")))
                {
                    object leg = G(G(data, "legendaries"), S(G(s, "key")));
                    if (leg != null && S(G(leg, "icon")) == replIcon && (replText.Contains(S(G(G(s, "name"), "fr"))) || replText.Contains(S(G(G(s, "name"), "en"))))) amulet = "leg:" + S(G(s, "key"));
                }
            }
            int capTree;
            if (info.Type == "spell" && S(G(card, "kind")) == "new" && info.Key != null) offeredNew.Add(info.Key);
            if (info.Type == "spell" && S(G(card, "kind")) == "upgrade" && info.Key != null && !offeredNew.Contains(info.Key) && !owned.ContainsKey(info.Key) && capSpells.TryGetValue(info.Key, out capTree)) DetectSpec(capTree, "card " + info.Key);
            if (info.Type == "spell" && S(G(card, "kind")) == "upgrade" && info.Key != null) owned[info.Key] = (int)N(G(card, "rank"), 2) - 1;
            if (info.Key != null && ban.ContainsKey(info.Key)) { if (banIdx == 0) banIdx = i; scores.Add(i + ". " + S(G(card, "title")) + " banni"); continue; }
            double baseW = 0;
            bool target = false;
            if (info.Type == "spell" && info.Key != null)
            {
                baseW = SpellWeight(info.Key);
                if (S(G(card, "kind")) == "upgrade") { int r = (int)N(G(card, "rank"), 2); baseW *= r <= 3 ? 1 : r <= 6 ? 0.67 : r <= 10 ? 0.5 : 0.35; }
                List<object> sp = A(G(build, "spells")).ToList();
                int idx = sp.FindIndex(x => S(G(x, "key")) == info.Key);
                target = idx >= 0 && idx < 6;
            }
            else if (info.Key != null)
            {
                int want = info.Cat == "amulets" ? 1 : 2;
                List<string> list = A(G(build, info.Cat)).Select(S).ToList();
                int idx = list.IndexOf(info.Key);
                double w = JewelWeight(info.Cat, info.Key);
                bool upgrade = info.Cat == "amulets" ? info.Key == amulet : jewels.ContainsKey(info.Key);
                if (upgrade)
                {
                    int jr = JewelRank(S(G(card, "title")));
                    baseW = Math.Max(w, 4) * (jr <= 3 ? 1 : jr <= 6 ? 0.67 : jr <= 10 ? 0.5 : 0.35);
                    target = true;
                }
                else if (info.Cat == "amulets")
                {
                    double wornW = amulet != null ? JewelWeight("amulets", amulet) * (1 + 0.25 * amuletUps) : 0;
                    // Repli générique : aucune amulette du build n'est sortie, aucune n'est portée, niveau de repli
                    // atteint. Sans ça le compagnon ignore toute amulette non listée (poids 0 à vie dans
                    // JewelWeight), alors que n'importe laquelle vaut mieux que rien tant qu'on attend la bonne.
                    if (w == 0 && amulet == null && !info.Key.StartsWith("leg:") && lvl >= N(G(rules, "fallbackLevel"), 10)) w = 4;
                    if (w > wornW) { baseW = amulet == null && !(idx >= want && lvl < N(G(rules, "fallbackLevel"), 10)) ? w * 1.5 : w; target = idx >= 0 && idx < want; }
                }
                else if (jewels.Values.Count(v => v == info.Cat) < 2)
                {
                    if (idx >= 0 && idx < want) { baseW = w; target = true; }
                    else if (idx >= want && lvl >= N(G(rules, "fallbackLevel"), 10)) baseW = w;
                }
                bool empty = info.Cat == "amulets" ? amulet == null : jewels.Values.Count(v => v == info.Cat) < 2;
                if (!upgrade && baseW > 0 && empty && lvl >= N(G(rules, "fallbackLevel"), 10)) { baseW *= 3; target = true; }
            }
            double score = baseW * (1 + infl * N(G(card, "rarity"), 0));
            scores.Add(i + ". " + S(G(card, "title")) + " (" + S(G(card, "rarityName")) + ") " + (info.Key ?? "?") + " base " + Math.Round(baseW, 2) + " score " + Math.Round(score, 2) + (target ? " cible" : ""));
            if (score > bestScore) { bestScore = score; best = i; bestTarget = target; }
        }
        Log("  scores: " + string.Join(" | ", scores));
        lastScores = scores.ToArray();
        double luck = Luck();
        string luckTxt = luck > 0 ? (fr ? " · chance " : " · luck ") + Math.Round(luck) + " %" : "";
        if (best > 0 && !bestTarget)
        {
            double top = A(G(build, "spells")).Take(6).Select(x => N(G(x, "w"), 3)).DefaultIfEmpty(3).Max();
            bool weak = bestScore < 0.4 * top * ExpectedRarity(luck, infl);
            if (weak && reroll && rerolls > reserve)
                return new Advice { Text = (fr ? "Carte moyenne, relancer (R) : " + rerolls + " restantes" : "Average card, reroll (R): " + rerolls + " left") + luckTxt, Key = "r" };
            if (weak && jewelScreen && B(G(j, "skip")))
                return new Advice { Text = fr ? "Rien d'utile : passer (X, +" + S(G(j, "skipGold")) + " or)" : "Nothing useful: skip (X, +" + S(G(j, "skipGold")) + " gold)", Key = "x" };
        }
        if (best > 0)
        {
            object c = cards[best - 1];
            return new Advice { Text = (fr ? "Prendre " + best + " : " : "Take " + best + ": ") + S(G(c, "title")) + " (" + S(G(c, "rarityName")) + ")", Key = best.ToString(), Pick = c };
        }
        if (reroll && rerolls > 0)
            return new Advice { Text = (fr ? "Aucune carte du build : relancer (R), " + rerolls + " restantes" : "No card from the build: reroll (R), " + rerolls + " left") + luckTxt, Key = "r" };
        if (B(G(j, "skip")))
            return new Advice { Text = fr ? "Aucune carte du build, plus de relance : passer (X, +" + S(G(j, "skipGold")) + " or)" : "No card from the build, no rerolls left: skip (X, +" + S(G(j, "skipGold")) + " gold)", Key = "x" };
        return new Advice { Text = fr ? "Aucune carte du build, plus de relance, pas de skip : choisissez vous-même" : "No card from the build, no rerolls left, no skip: choose yourself" };
    }
}
