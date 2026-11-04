"""Prepare standard-library dependencies once; learner builds remain offline."""
import glob, os, pathlib, shutil, subprocess

pathlib.Path('/opt/rust-seed/src').mkdir(parents=True)
pathlib.Path('/opt/rust-seed/.cargo').mkdir()
pathlib.Path('/opt/rust-seed/Cargo.toml').write_text('[package]\nname="invarith_run"\nversion="0.1.0"\nedition="2021"\n[dependencies]\nserde_json="1"\n')
pathlib.Path('/opt/rust-seed/.cargo/config.toml').write_text('[source.crates-io]\nreplace-with="debian"\n[source.debian]\ndirectory="/usr/share/cargo/registry"\n')
pathlib.Path('/opt/rust-seed/src/main.rs').write_text('fn main(){println!("{}",serde_json::json!([]));}')
subprocess.run(['cargo','build','--offline','--release','-j','1'],cwd='/opt/rust-seed',check=True)
pathlib.Path('/opt/go-seed').mkdir()
pathlib.Path('/opt/go-seed/main.go').write_text('package main\nimport("encoding/json";"reflect";"fmt";"os")\nfunc main(){fmt.Println(reflect.TypeOf(json.NewDecoder(os.Stdin)))}\n')
subprocess.run(['go','build','-p=1','-o','/opt/go-seed/prime','/opt/go-seed/main.go'],env={**os.environ,'GOCACHE':'/opt/go-cache','GOMAXPROCS':'2','GO111MODULE':'off'},check=True)
dll=glob.glob('/usr/lib/cli/Newtonsoft.Json-*/Newtonsoft.Json.dll')[0]
shutil.copy2(dll,'/opt/Newtonsoft.Json.dll')
for root, dirs, files in os.walk('/opt'):
    os.chmod(root,0o755)
    for file in files:
        path=os.path.join(root,file)
        os.chmod(path,0o755 if os.access(path,os.X_OK) else 0o644)
