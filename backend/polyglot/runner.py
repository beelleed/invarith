"""Container-only compiler/runner. Expected answers are never passed to learner programs."""
import json, os, resource, subprocess, sys, tempfile, time, shutil

JAVA = r'''
import com.google.gson.*;
import java.lang.reflect.*;
class Harness {
 static void validate(JsonElement value,Type type){
  if(value.isJsonNull()){if(type instanceof Class<?> && ((Class<?>)type).isPrimitive())throw new IllegalArgumentException("JSON null cannot be passed to a primitive parameter");return;}
  if(type instanceof ParameterizedType){ParameterizedType p=(ParameterizedType)type;Class<?> raw=(Class<?>)p.getRawType();
   if(java.util.Collection.class.isAssignableFrom(raw)){if(!value.isJsonArray())throw new IllegalArgumentException("Expected a JSON array");for(JsonElement child:value.getAsJsonArray())validate(child,p.getActualTypeArguments()[0]);return;}
   if(java.util.Map.class.isAssignableFrom(raw)){if(!value.isJsonObject())throw new IllegalArgumentException("Expected a JSON object");for(java.util.Map.Entry<String,JsonElement> entry:value.getAsJsonObject().entrySet())validate(entry.getValue(),p.getActualTypeArguments()[1]);return;}
   type=raw;
  }
  if(!(type instanceof Class<?>))return;Class<?> c=(Class<?>)type;
  if(value.isJsonNull()){if(c.isPrimitive())throw new IllegalArgumentException("JSON null cannot be passed to a primitive parameter");return;}
  if(JsonElement.class.isAssignableFrom(c)||c==Object.class)return;
  if(c.isArray()){if(!value.isJsonArray())throw new IllegalArgumentException("Expected a JSON array");for(JsonElement child:value.getAsJsonArray())validate(child,c.getComponentType());return;}
  if(c==String.class||c==char.class||c==Character.class){if(!value.isJsonPrimitive()||!value.getAsJsonPrimitive().isString()||c!=String.class&&value.getAsString().length()!=1)throw new IllegalArgumentException("Expected a JSON string matching the parameter type");return;}
  if(c==boolean.class||c==Boolean.class){if(!value.isJsonPrimitive()||!value.getAsJsonPrimitive().isBoolean())throw new IllegalArgumentException("Expected a JSON boolean");return;}
  if(c.isPrimitive()||Number.class.isAssignableFrom(c)){
   if(!value.isJsonPrimitive()||!value.getAsJsonPrimitive().isNumber())throw new IllegalArgumentException("Expected a JSON number");
   java.math.BigDecimal n=value.getAsBigDecimal();
   if(c==int.class||c==Integer.class)n.intValueExact();else if(c==long.class||c==Long.class)n.longValueExact();else if(c==short.class||c==Short.class)n.shortValueExact();else if(c==byte.class||c==Byte.class)n.byteValueExact();
  }
 }
 public static void main(String[] unused) throws Exception {
  Gson gson=new Gson(); JsonObject input=JsonParser.parseReader(new java.io.InputStreamReader(System.in)).getAsJsonObject();
  Method method=null;
  for(Method candidate:Solution.class.getDeclaredMethods()) if(candidate.getName().equals("FUNCTION") && candidate.getParameterCount()==input.getAsJsonArray("args").size()) { if(method!=null)throw new IllegalArgumentException("Ambiguous overload"); method=candidate; }
  if(method==null)throw new IllegalArgumentException("Target method was not found in Solution");
  method.setAccessible(true); Type[] types=method.getGenericParameterTypes(); Object[] args=new Object[types.length];
  for(int i=0;i<args.length;i++){validate(input.getAsJsonArray("args").get(i),types[i]);args[i]=gson.fromJson(input.getAsJsonArray("args").get(i),types[i]);}
  Object actual=method.invoke(Modifier.isStatic(method.getModifiers())?null:new Solution(),args);
  System.out.println("\n__INVARITH_RESULT__"+gson.toJson(actual));
 }
}
'''
CPP = r'''
#include <nlohmann/json.hpp>
#include <type_traits>
#include <tuple>
#include <iostream>
#include <cmath>
#include <limits>
template<class T>struct InvarithVector:std::false_type{};
template<class T,class A>struct InvarithVector<std::vector<T,A>>:std::true_type{using Element=T;};
template<class T>T invarithDecode(const nlohmann::json& value){
 if constexpr(std::is_same_v<T,nlohmann::json>)return value;
 else if constexpr(InvarithVector<T>::value){if(!value.is_array())throw std::runtime_error("Expected a JSON array");T out;for(const auto& child:value)out.push_back(invarithDecode<typename InvarithVector<T>::Element>(child));return out;}
 else if constexpr(std::is_same_v<T,bool>){if(!value.is_boolean())throw std::runtime_error("Expected a JSON boolean");}
 else if constexpr(std::is_integral_v<T>){if(!value.is_number())throw std::runtime_error("Expected an integer");long double n=value.get<long double>();if(std::floor(n)!=n||n<std::numeric_limits<T>::lowest()||n>std::numeric_limits<T>::max())throw std::runtime_error("Integer argument is outside the parameter type range");}
 else if constexpr(std::is_floating_point_v<T>){if(!value.is_number())throw std::runtime_error("Expected a JSON number");}
 else if constexpr(std::is_same_v<T,std::string>){if(!value.is_string())throw std::runtime_error("Expected a JSON string");}
 return value.get<T>();
}
void invarithJsonCheck(const nlohmann::json& value){
 if(value.is_number_float()&&!std::isfinite(value.get<double>()))throw std::runtime_error("Return values must contain finite numbers");
 if(value.is_structured())for(const auto& child:value)invarithJsonCheck(child);
}
template<class> struct InvarithTraits;
template<class R,class...A> struct InvarithTraits<R(*)(A...)> {using Args=std::tuple<std::decay_t<A>...>;};
template<class F,size_t...I> nlohmann::json invarithCall(F fn,const nlohmann::json& a,std::index_sequence<I...>){
 using Types=typename InvarithTraits<F>::Args;
 if(a.size()!=sizeof...(I))throw std::runtime_error("Wrong argument count");
 Types values{invarithDecode<std::tuple_element_t<I,Types>>(a.at(I))...};
 return std::apply(fn,values);
}
int main(){try{nlohmann::json input;std::cin>>input;using Args=typename InvarithTraits<decltype(&FUNCTION)>::Args;
 auto actual=invarithCall(&FUNCTION,input.at("args"),std::make_index_sequence<std::tuple_size_v<Args>>{});
 invarithJsonCheck(actual);
 std::cout<<"\n__INVARITH_RESULT__"<<actual.dump()<<std::endl;
}catch(const std::exception& e){std::cerr<<e.what();return 1;}}
'''
JS = r'''
const fs = require('node:fs');
function invarithJsonCheck(value,seen=new Set(),depth=0){
 if(depth>64)throw Error('Return value is nested too deeply');
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'&&Number.isFinite(value))return;
 if(typeof value!=='object'||seen.has(value))throw Error('Return a JSON-compatible value without cycles or undefined values');
 if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error('Return plain JSON objects or arrays');
 seen.add(value);for(const child of Array.isArray(value)?value:Object.values(value))invarithJsonCheck(child,seen,depth+1);seen.delete(value);
}
Promise.resolve().then(async()=>{
 const input=JSON.parse(fs.readFileSync(0,'utf8'));
 const actual=await FUNCTION(...input.args);
 invarithJsonCheck(actual);
 const value=JSON.stringify(actual);
 if(value===undefined)throw Error('Return a JSON-compatible value; received undefined');
 process.stdout.write('\n__INVARITH_RESULT__'+value+'\n');
}).catch(error=>{console.error(String(error?.stack||error));process.exitCode=1;});
'''

def bounded_child(max_file):
    resource.setrlimit(resource.RLIMIT_FSIZE, (max_file, max_file))
    os.setsid()

def call(command, text='', timeout=2, max_file=65536):
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=out, stderr=err, preexec_fn=lambda:bounded_child(max_file))
        try:
            child.communicate(text.encode(), timeout=timeout)
        except subprocess.TimeoutExpired:
            import signal
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
            raise ValueError('Time limit exceeded')
        out.seek(0); err.seek(0)
        return child.returncode, out.read(65536).decode(errors='replace'), err.read(65536).decode(errors='replace')

submission=json.load(sys.stdin)
language, name, code=submission['codeLanguage'], submission['functionName'], submission['code']
os.chdir(tempfile.mkdtemp(prefix='invarith-',dir='/tmp'))
compile_error=None
try:
    if language=='javascript':
        filename='submission.cjs'
        with open(filename,'w') as f:f.write(code+'\n'+JS.replace('FUNCTION',name))
        execute=['node','--max-old-space-size=128',filename]
    elif language=='typescript':
        with open('submission.ts','w') as f:f.write(code)
        status,out,err=call(['tsc','submission.ts','--target','ES2022','--module','commonjs','--strict','--noEmitOnError','--skipLibCheck','--types','node','--typeRoots','/usr/local/lib/node_modules/@types','--outDir','compiled'],timeout=15,max_file=33554432)
        if status:raise ValueError(out or err)
        with open('compiled/submission.js','a') as f:f.write('\n'+JS.replace('FUNCTION',name))
        execute=['node','--max-old-space-size=128','compiled/submission.js']
    elif language=='java':
        with open('Solution.java','w') as f:f.write(code)
        with open('Harness.java','w') as f:f.write(JAVA.replace('FUNCTION',name))
        status,out,err=call(['javac','-J-Xmx128m','-cp','/usr/share/java/gson.jar','Solution.java','Harness.java'],timeout=12,max_file=33554432)
        if status:raise ValueError(err)
        execute=['java','-Xmx128m','-Xss256k','-XX:ReservedCodeCacheSize=32m','-XX:CompressedClassSpaceSize=32m','-cp','.:/usr/share/java/gson.jar','Harness']
    elif language=='cpp':
        with open('submission.cpp','w') as f:f.write(code+'\n'+CPP.replace('FUNCTION',name))
        status,out,err=call(['g++','-std=c++17','-O1','-pipe','submission.cpp','-o','submission'],timeout=15,max_file=33554432)
        if status:raise ValueError(err)
        execute=['./submission']
    elif language=='go':
        shutil.copytree('/opt/go-cache','go-cache')
        os.environ.update({'GOCACHE':os.path.abspath('go-cache'),'GO111MODULE':'off','GOPROXY':'off','GOMAXPROCS':'2','HOME':'/tmp'})
        with open('submission.go','w') as f:f.write(code)
        with open('harness.go','w') as f:f.write(GO.replace('FUNCTION',name))
        status,out,err=call(['go','build','-p=1','-o','submission','submission.go','harness.go'],timeout=20,max_file=33554432)
        if status:raise ValueError(err)
        execute=['./submission']
    elif language=='rust':
        shutil.copytree('/opt/rust-seed','rust-work')
        args=','.join('serde_json::from_value(args[%d].clone())?' % i for i in range(len(submission['cases'][0]['args'])))
        harness=RUST.replace('ARGUMENTS',args).replace('ARGCOUNT',str(len(submission['cases'][0]['args']))).replace('FUNCTION',name)
        with open('rust-work/src/main.rs','w') as f:f.write(code+'\n'+harness)
        os.environ.update({'HOME':'/tmp','CARGO_HOME':'/tmp/cargo-home'})
        status,out,err=call(['cargo','build','--manifest-path','rust-work/Cargo.toml','--offline','--release','-j','1','--config',os.path.abspath('rust-work/.cargo/config.toml')],timeout=20,max_file=33554432)
        if status:raise ValueError(err)
        execute=['./rust-work/target/release/invarith_run']
    elif language=='csharp':
        with open('Solution.cs','w') as f:f.write(code)
        with open('Harness.cs','w') as f:f.write(CSHARP.replace('FUNCTION',name))
        shutil.copy2('/opt/Newtonsoft.Json.dll','Newtonsoft.Json.dll')
        status,out,err=call(['mcs','-langversion:7.2','-r:Newtonsoft.Json.dll','-out:submission.exe','-main:InvarithHarness','Solution.cs','Harness.cs'],timeout=12,max_file=33554432)
        if status:raise ValueError(out or err)
        execute=['mono','submission.exe']
    elif language=='kotlin':
        with open('Submission.kt','w') as f:f.write(code)
        harness=JAVA.replace('Solution.class','Class.forName("SubmissionKt")').replace('new Solution()','null').replace('FUNCTION',name)
        with open('Harness.java','w') as f:f.write(harness)
        status,out,err=call(['kotlinc','-J-Xmx256m','-J-XX:ActiveProcessorCount=2','-classpath','/usr/share/java/gson.jar','Submission.kt','-include-runtime','-d','submission.jar'],timeout=20,max_file=33554432)
        if status:raise ValueError(out or err)
        status,out,err=call(['javac','-J-Xmx128m','-cp','submission.jar:/usr/share/java/gson.jar','Harness.java'],timeout=12,max_file=33554432)
        if status:raise ValueError(err)
        execute=['java','-Xmx128m','-XX:ActiveProcessorCount=2','-cp','.:submission.jar:/usr/share/java/gson.jar','Harness']
    elif language=='ruby':
        with open('submission.rb','w') as f:f.write(code)
        with open('harness.rb','w') as f:f.write(RUBY.replace('FUNCTION',name))
        execute=['ruby','harness.rb']
    elif language=='php':
        with open('submission.php','w') as f:f.write(code)
        with open('harness.php','w') as f:f.write(PHP.replace('FUNCTION',name))
        execute=['php','-d','memory_limit=128M','harness.php']
    elif language=='c':
        args=','.join('cJSON_GetArrayItem(args,%d)' % i for i in range(len(submission['cases'][0]['args'])))
        harness=C.replace('ARGUMENTS',args).replace('ARGCOUNT',str(len(submission['cases'][0]['args']))).replace('FUNCTION',name)
        with open('submission.c','w') as f:f.write(code+'\n'+harness)
        status,out,err=call(['gcc','-std=c17','-Wall','-Wextra','-Werror=implicit-function-declaration','submission.c','-lcjson','-lm','-o','submission'],timeout=12,max_file=33554432)
        if status:raise ValueError(err)
        execute=['./submission']
    else:raise ValueError('Unsupported programming language')
except Exception as error:compile_error=str(error)[:4000]

results=[]
for index,case in enumerate(submission['cases']):
    started=time.monotonic()
    try:
        if compile_error:raise ValueError('Compilation failed: '+compile_error)
        if case.get('kwargs'):raise ValueError('Use positional arguments for this programming language')
        status,out,err=call(execute,json.dumps({'args':case['args']}))
        if status:raise ValueError((err or out or 'Program exited without a result')[-4000:])
        marker='__INVARITH_RESULT__'
        if marker not in out:raise ValueError('Program did not return a JSON-compatible result')
        actual=json.loads(out.rsplit(marker,1)[1].strip())
        results.append({'index':index,'status':'passed' if actual==case.get('expected') else 'failed','actual':actual,'stdout':out.rsplit(marker,1)[0][-2000:],'trace':[],'traceUnavailable':'Line tracing is currently available for Python only.'})
    except Exception as error:results.append({'index':index,'status':'error','error':str(error)[:4000],'trace':[]})
    results[-1]['durationMs']=round((time.monotonic()-started)*1000,3)
json.dump({'results':results},sys.stdout,allow_nan=False)
