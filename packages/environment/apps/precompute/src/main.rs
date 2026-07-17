use environment_precompute::build_fixture_report;

fn main() {
    let arguments = std::env::args().skip(1).collect::<Vec<_>>();
    if arguments.as_slice() != ["fixture-report"] {
        eprintln!("usage: environment-precompute fixture-report");
        std::process::exit(2);
    }
    let report = build_fixture_report().expect("committed extracted fixtures should conform");
    println!(
        "{}",
        serde_json::to_string_pretty(&report).expect("report serialization should succeed")
    );
}
