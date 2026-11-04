GO = r'''
package main
import ("encoding/json";"reflect";"fmt";"os";"bytes")
func invarithValidate(raw json.RawMessage,t reflect.Type){
 if bytes.Equal(bytes.TrimSpace(raw),[]byte("null")){switch t.Kind(){case reflect.Ptr,reflect.Slice,reflect.Map,reflect.Interface:return;default:panic("JSON null does not match this parameter type")}}
 switch t.Kind(){
 case reflect.Ptr:invarithValidate(raw,t.Elem())
 case reflect.Slice,reflect.Array:
  if t.Kind()==reflect.Slice&&t.Elem().Kind()==reflect.Uint8&&len(bytes.TrimSpace(raw))>0&&bytes.TrimSpace(raw)[0]=='"'{return}
  var items []json.RawMessage;if err:=json.Unmarshal(raw,&items);err!=nil{panic(err)}
  if t.Kind()==reflect.Array&&len(items)!=t.Len(){panic("Fixed array length does not match input")}
  for _,item:=range items{invarithValidate(item,t.Elem())}
 case reflect.Map:
  var items map[string]json.RawMessage;if err:=json.Unmarshal(raw,&items);err!=nil{panic(err)}
  for _,item:=range items{invarithValidate(item,t.Elem())}
 }
}
func main(){
 var input struct { Args []json.RawMessage `json:"args"` }
 if err:=json.NewDecoder(os.Stdin).Decode(&input);err!=nil {panic(err)}
 fn:=reflect.ValueOf(FUNCTION);t:=fn.Type()
 if t.IsVariadic()||len(input.Args)!=t.NumIn(){panic("Argument count does not match function")}
 args:=make([]reflect.Value,len(input.Args))
 for i,raw:=range input.Args {invarithValidate(raw,t.In(i));value:=reflect.New(t.In(i));if err:=json.Unmarshal(raw,value.Interface());err!=nil{panic(err)};args[i]=value.Elem()}
 result:=fn.Call(args)
 if len(result)!=1 {panic("Return exactly one JSON-compatible value")}
 encoded,err:=json.Marshal(result[0].Interface());if err!=nil{panic(err)}
 fmt.Println("\n__INVARITH_RESULT__"+string(encoded))
}
'''
RUST = r'''
trait InvarithFinite {fn invarith_finite(&self)->bool;}
macro_rules! invarith_scalars {($($t:ty),*)=>{$(impl InvarithFinite for $t {fn invarith_finite(&self)->bool{true}})*};}
invarith_scalars!(bool,String,str,char,(),i8,i16,i32,i64,i128,isize,u8,u16,u32,u64,u128,usize,serde_json::Value);
impl InvarithFinite for f64 {fn invarith_finite(&self)->bool{self.is_finite()}}
impl InvarithFinite for f32 {fn invarith_finite(&self)->bool{self.is_finite()}}
impl<T:InvarithFinite> InvarithFinite for Vec<T> {fn invarith_finite(&self)->bool{self.iter().all(|v|v.invarith_finite())}}
impl<T:InvarithFinite> InvarithFinite for Option<T> {fn invarith_finite(&self)->bool{self.as_ref().map_or(true,|v|v.invarith_finite())}}
impl<T:InvarithFinite+?Sized> InvarithFinite for &T {fn invarith_finite(&self)->bool{(**self).invarith_finite()}}
impl<T:InvarithFinite,const N:usize> InvarithFinite for [T;N] {fn invarith_finite(&self)->bool{self.iter().all(|v|v.invarith_finite())}}
impl<T:InvarithFinite> InvarithFinite for std::collections::HashMap<String,T> {fn invarith_finite(&self)->bool{self.values().all(|v|v.invarith_finite())}}
impl<T:InvarithFinite> InvarithFinite for std::collections::BTreeMap<String,T> {fn invarith_finite(&self)->bool{self.values().all(|v|v.invarith_finite())}}
impl<A:InvarithFinite,B:InvarithFinite> InvarithFinite for (A,B) {fn invarith_finite(&self)->bool{self.0.invarith_finite()&&self.1.invarith_finite()}}
fn main() -> Result<(),Box<dyn std::error::Error>> {
 use std::io::Read as _;
 let mut text=String::new();std::io::stdin().read_to_string(&mut text)?;
 let input:serde_json::Value=serde_json::from_str(&text)?;
 let args=input["args"].as_array().ok_or("Expected an argument array")?;
 if args.len()!=ARGCOUNT{return Err("Wrong argument count".into());}
 let actual=FUNCTION(ARGUMENTS);
 if !actual.invarith_finite(){return Err("Return finite numbers only".into());}
 let value=serde_json::to_value(actual)?;
 println!("\n__INVARITH_RESULT__{}",serde_json::to_string(&value)?);
 Ok(())
}
'''
CSHARP = r'''
using System;
using System.Reflection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
class InvarithHarness {
 static void ValidateInput(JToken value,Type type){
  Type nullable=Nullable.GetUnderlyingType(type);
  if(value.Type==JTokenType.Null){if(type.IsValueType&&nullable==null)throw new Exception("JSON null cannot be passed to a value parameter");return;}
  type=nullable??type;
  if(typeof(JToken).IsAssignableFrom(type)||type==typeof(object))return;
  if(type.IsArray){if(value.Type!=JTokenType.Array)throw new Exception("Expected a JSON array");foreach(var child in value)ValidateInput(child,type.GetElementType());return;}
  if(type.IsGenericType&&type.GetGenericTypeDefinition()==typeof(System.Collections.Generic.List<>)){if(value.Type!=JTokenType.Array)throw new Exception("Expected a JSON array");foreach(var child in value)ValidateInput(child,type.GetGenericArguments()[0]);return;}
  if(type==typeof(string)||type==typeof(char)){if(value.Type!=JTokenType.String)throw new Exception("Expected a JSON string");return;}
  if(type==typeof(bool)){if(value.Type!=JTokenType.Boolean)throw new Exception("Expected a JSON boolean");return;}
  if(type.IsPrimitive||type==typeof(decimal)){if(value.Type!=JTokenType.Integer&&value.Type!=JTokenType.Float)throw new Exception("Expected a JSON number");if(type!=typeof(float)&&type!=typeof(double)&&type!=typeof(decimal)){decimal n=value.Value<decimal>();if(Decimal.Truncate(n)!=n)throw new Exception("Expected an integer without a fractional part");}}
 }
 static void Validate(JToken value){
  if(value.Type==JTokenType.Float){double number=value.Value<double>();if(Double.IsNaN(number)||Double.IsInfinity(number))throw new Exception("Return finite numbers only");}
  foreach(var child in value.Children())Validate(child);
 }
 static void Main(){try{
  var input=JObject.Parse(Console.In.ReadToEnd());var args=(JArray)input["args"];MethodInfo method=null;
  foreach(var candidate in typeof(Solution).GetMethods(BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Static|BindingFlags.Instance|BindingFlags.DeclaredOnly))if(candidate.Name=="FUNCTION"&&candidate.GetParameters().Length==args.Count){if(method!=null)throw new Exception("Ambiguous overload");method=candidate;}
  if(method==null)throw new Exception("Target method was not found in Solution");
  var types=method.GetParameters();var converted=new object[types.Length];
  for(int i=0;i<types.Length;i++){ValidateInput(args[i],types[i].ParameterType);converted[i]=args[i].ToObject(types[i].ParameterType);}
  var actual=method.Invoke(method.IsStatic?null:new Solution(),converted);var value=actual==null?JValue.CreateNull():JToken.FromObject(actual);Validate(value);
  Console.WriteLine("\n__INVARITH_RESULT__"+value.ToString(Formatting.None));
 }catch(Exception e){Console.Error.WriteLine(e);Environment.ExitCode=1;}}
}
'''
RUBY = r'''
require 'json'
load File.join(__dir__,'submission.rb')
input=JSON.parse(STDIN.read)
actual=send(:FUNCTION,*input.fetch('args'))
puts "\n__INVARITH_RESULT__"+JSON.generate(actual,allow_nan:false)
'''
PHP = r'''<?php
require __DIR__.'/submission.php';
try {
 $input=json_decode(stream_get_contents(STDIN),false,512,JSON_THROW_ON_ERROR);
 $actual=FUNCTION(...$input->args);
 echo "\n__INVARITH_RESULT__".json_encode($actual,JSON_THROW_ON_ERROR|JSON_PRESERVE_ZERO_FRACTION)."\n";
} catch(Throwable $error){fwrite(STDERR,(string)$error);exit(1);}
'''
C = r'''
#include <cjson/cJSON.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
static int invarithValidate(const cJSON *value){
 if(cJSON_IsNumber(value)&&!isfinite(value->valuedouble))return 0;
 for(const cJSON *child=value->child;child;child=child->next)if(!invarithValidate(child))return 0;
 return 1;
}
int main(void){
 size_t used=0,capacity=4096;char *text=malloc(capacity);if(!text)return 1;
 int ch;while((ch=getchar())!=EOF){if(used+1>=capacity){capacity*=2;char *next=realloc(text,capacity);if(!next){free(text);return 1;}text=next;}text[used++]=(char)ch;}text[used]=0;
 cJSON *input=cJSON_Parse(text);free(text);if(!input){fprintf(stderr,"Invalid JSON input");return 1;}
 const cJSON *args=cJSON_GetObjectItemCaseSensitive(input,"args");if(!cJSON_IsArray(args)||cJSON_GetArraySize(args)!=ARGCOUNT){fprintf(stderr,"Wrong argument count");return 1;}
 cJSON *actual=FUNCTION(ARGUMENTS);
 if(!actual||!invarithValidate(actual)){fprintf(stderr,"Return a cJSON value with finite numbers; use cJSON_CreateNull() for null");return 1;}
 char *output=cJSON_PrintUnformatted(actual);if(!output)return 1;
 printf("\n__INVARITH_RESULT__%s\n",output);free(output);return 0;
}
'''
