from pathlib import Path
import hashlib,json,plistlib
root=Path(__file__).resolve().parent.parent
project=root/'SberKids.xcodeproj';project.mkdir(exist_ok=True)
def uid(s):return hashlib.sha1(s.encode()).hexdigest()[:24].upper()
objects={}
def add(key,isa,**kw):
 i=uid(key);objects[i]={'isa':isa,**kw};return i
def ref(path,kind):return add('ref'+path,'PBXFileReference',lastKnownFileType=kind,path=path,sourceTree='<group>')
def build(ref):return add('build'+ref,'PBXBuildFile',fileRef=ref)
appfiles=sorted((root/'SberKids').rglob('*.swift'));tests=sorted((root/'Tests').glob('*.swift'));uitests=sorted((root/'UITests').glob('*.swift'))
files={p:ref(str(p.relative_to(root)),'sourcecode.swift') for p in appfiles+tests+uitests}
resources=[ref(str(p.relative_to(root)),'text.json') for p in sorted((root/'SberKids/Resources/Content').glob('*.json'))]
resources.append(ref('SberKids/Resources/Assets.xcassets','folder.assetcatalog'))
products=[add('product'+n,'PBXFileReference',explicitFileType='wrapper.application' if i==0 else 'wrapper.cfbundle',path=n+('.app' if i==0 else '.xctest'),sourceTree='BUILT_PRODUCTS_DIR') for i,n in enumerate(['SberKids','SberKidsTests','SberKidsUITests'])]
group=add('main','PBXGroup',children=list(files.values())+resources+[add('products','PBXGroup',children=products,name='Products',sourceTree='<group>')],sourceTree='<group>')
def conf(key,name,settings):return add(key+name,'XCBuildConfiguration',name=name,buildSettings=settings)
def clist(key,settings):return add(key+'config','XCConfigurationList',buildConfigurations=[conf(key,n,{**settings,**({'SWIFT_OPTIMIZATION_LEVEL':'-Onone','DEBUG_INFORMATION_FORMAT':'dwarf','ENABLE_TESTABILITY':'YES','SWIFT_ACTIVE_COMPILATION_CONDITIONS':'DEBUG'} if n=='Debug' else {'SWIFT_COMPILATION_MODE':'wholemodule','SWIFT_OPTIMIZATION_LEVEL':'-O','DEBUG_INFORMATION_FORMAT':'dwarf-with-dsym'})}) for n in ['Debug','Release']],defaultConfigurationIsVisible=0,defaultConfigurationName='Release')
common={'SDKROOT':'iphoneos','IPHONEOS_DEPLOYMENT_TARGET':'15.0','SWIFT_VERSION':'6.0','SWIFT_STRICT_CONCURRENCY':'complete','CLANG_ENABLE_MODULES':'YES','CLANG_ENABLE_OBJC_ARC':'YES','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator','TARGETED_DEVICE_FAMILY':'1','CODE_SIGN_STYLE':'Automatic','ENABLE_USER_SCRIPT_SANDBOXING':'YES'}
targets=[]
for i,(name,paths) in enumerate([('SberKids',appfiles),('SberKidsTests',tests),('SberKidsUITests',uitests)]):
 settings={'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'org.sberhack.kids.'+['native','tests','uitests'][i],'GENERATE_INFOPLIST_FILE':'YES'}
 if i==0:settings.update({'INFOPLIST_FILE':'SberKids/Info.plist','CURRENT_PROJECT_VERSION':'1','MARKETING_VERSION':'1.0','INFOPLIST_KEY_UIApplicationSceneManifest_Generation':'YES','INFOPLIST_KEY_UILaunchScreen_Generation':'YES','INFOPLIST_KEY_UISupportedInterfaceOrientations':'UIInterfaceOrientationPortrait','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks'})
 elif i==1:settings.update({'TEST_HOST':'$(BUILT_PRODUCTS_DIR)/SberKids.app/SberKids','BUNDLE_LOADER':'$(TEST_HOST)','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks @loader_path/Frameworks'})
 else:settings.update({'TEST_TARGET_NAME':'SberKids','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks @loader_path/Frameworks'})
 phases=[add(name+'sources','PBXSourcesBuildPhase',buildActionMask=2147483647,files=[build(files[p]) for p in paths],runOnlyForDeploymentPostprocessing=0),add(name+'frameworks','PBXFrameworksBuildPhase',buildActionMask=2147483647,files=[],runOnlyForDeploymentPostprocessing=0),add(name+'resources','PBXResourcesBuildPhase',buildActionMask=2147483647,files=[build(r) for r in resources] if i==0 else [],runOnlyForDeploymentPostprocessing=0)]
 dependencies=[]
 if i>0:
  proxy=add(name+'proxy','PBXContainerItemProxy',containerPortal=uid('project'),proxyType=1,remoteGlobalIDString=uid('SberKidstarget'),remoteInfo='SberKids')
  dependencies=[add(name+'dependency','PBXTargetDependency',target=uid('SberKidstarget'),targetProxy=proxy)]
 targets.append(add(name+'target','PBXNativeTarget',name=name,buildConfigurationList=clist(name,settings),buildPhases=phases,buildRules=[],dependencies=dependencies,productName=name,productReference=products[i],productType='com.apple.product-type.application' if i==0 else ('com.apple.product-type.bundle.unit-test' if i==1 else 'com.apple.product-type.bundle.ui-testing')))
proj=add('project','PBXProject',attributes={'BuildIndependentTargetsInParallel':'YES','LastUpgradeCheck':'2710'},buildConfigurationList=clist('project',common),compatibilityVersion='Xcode 14.0',developmentRegion='ru',knownRegions=['ru','en','Base'],mainGroup=group,productRefGroup=uid('products'),projectDirPath='',projectRoot='',targets=targets)
def fmt(v):
 if isinstance(v,dict):return '{\n'+'\n'.join(json.dumps(k)+' = '+fmt(val)+';' for k,val in v.items())+'\n}'
 if isinstance(v,list):return '('+','.join(fmt(x) for x in v)+')'
 return json.dumps(v) if isinstance(v,str) else str(v)
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n'+fmt({'archiveVersion':1,'classes':{},'objectVersion':56,'objects':objects,'rootObject':proj}))
scheme=project/'xcshareddata/xcschemes';scheme.mkdir(parents=True,exist_ok=True)
def b(i):return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{targets[i]}" BuildableName="{["SberKids.app","SberKidsTests.xctest","SberKidsUITests.xctest"][i]}" BlueprintName="{["SberKids","SberKidsTests","SberKidsUITests"][i]}" ReferencedContainer="container:SberKids.xcodeproj"/>'
(scheme/'SberKids.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?><Scheme LastUpgradeVersion="2710" version="1.7"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{b(0)}</BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{b(1)}</TestableReference><TestableReference skipped="NO">{b(2)}</TestableReference></Testables></TestAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{b(0)}</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{b(0)}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>''')
with (root/'SberKids/Info.plist').open('wb') as f:plistlib.dump({'CFBundleDisplayName':'СберKids','NSCameraUsageDescription':'Камера нужна, чтобы распознавать QR-коды на устройстве. Кадры не сохраняются и не отправляются в сеть.','ITSAppUsesNonExemptEncryption':False,'UISupportedInterfaceOrientations':['UIInterfaceOrientationPortrait']},f)
print('Generated',project)
