# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class **$$serializer { *; }
-keepclasseswithmembers class com.bor_devs.shoplist.** {
    @kotlinx.serialization.Serializable <fields>;
}
-keep,includedescriptorclasses class com.bor_devs.shoplist.**$$serializer { *; }
-keepclassmembers class com.bor_devs.shoplist.** {
    *** Companion;
}

# Retrofit / OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keepattributes Signature, Exceptions
