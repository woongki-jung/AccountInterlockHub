using System.Reflection;
using System.Resources;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;

[assembly: AssemblyTitle("AccountInterlockHub.SenderSdk")]
[assembly: AssemblyDescription("AccountInterlockHub 연동 라이브러리 — 발송처(서비스 A) 배포용. 전달 데이터 암호화와 연동 요청 URL 생성을 제공한다.")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("")]
[assembly: AssemblyProduct("AccountInterlockHub.SenderSdk")]
[assembly: AssemblyCopyright("")]
[assembly: AssemblyTrademark("")]
[assembly: AssemblyCulture("")]
[assembly: NeutralResourcesLanguage("ko")]

[assembly: ComVisible(false)]
[assembly: Guid("5907195b-16db-44a6-aa1f-f34bd7f1762d")]

[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

// 대상 런타임 명시 — csc.exe 직접 빌드는 MSBuild 처럼 이 속성을 자동으로 넣어 주지 않으므로
// 여기서 직접 선언한다(CLAUDE.env.md §연동 라이브러리 식별자 <LIB_TARGET_FRAMEWORK>).
[assembly: TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]
