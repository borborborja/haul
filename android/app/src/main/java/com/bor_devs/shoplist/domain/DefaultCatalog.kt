package com.bor_devs.shoplist.domain

/**
 * The built-in catalog used offline / before the server catalog loads. Ported
 * verbatim from web/src/data/constants.ts `defaultCategories`. The order here is
 * the canonical category order used for grouping/sorting.
 */
object DefaultCatalog {

    private fun li(es: String, ca: String, en: String) = LocalizedItem(es, ca, en)

    val categories: List<Category> = listOf(
        Category("fruit", "🍎", listOf(
            li("Manzanas", "Pomes", "Apples"),
            li("Plátanos", "Plàtans", "Bananas"),
            li("Naranjas", "Taronges", "Oranges"),
            li("Peras", "Peres", "Pears"),
            li("Fresas", "Maduixes", "Strawberries"),
            li("Uvas", "Raïm", "Grapes"),
            li("Limones", "Llimones", "Lemons"),
            li("Mandarinas", "Mandarines", "Tangerines"),
            li("Melón", "Meló", "Melon"),
            li("Sandía", "Síndria", "Watermelon"),
            li("Piña", "Pinya", "Pineapple"),
            li("Kiwi", "Kiwi", "Kiwi"),
            li("Melocotón", "Préssec", "Peach"),
            li("Cerezas", "Cireres", "Cherries"),
            li("Ciruelas", "Prunes", "Plums"),
            li("Aguacate", "Alvocat", "Avocado"),
            li("Pomelo", "Pomelo", "Grapefruit"),
            li("Higos", "Figues", "Figs"),
            li("Mango", "Mango", "Mango"),
            li("Papaya", "Papaia", "Papaya"),
        )),
        Category("veg", "🥦", listOf(
            li("Lechuga", "Enciam", "Lettuce"),
            li("Tomates", "Tomàquets", "Tomatoes"),
            li("Cebollas", "Cebes", "Onions"),
            li("Patatas", "Patates", "Potatoes"),
            li("Zanahorias", "Pastanagues", "Carrots"),
            li("Pimientos", "Pebrots", "Peppers"),
            li("Calabacín", "Carbassó", "Zucchini"),
            li("Rúcula", "Ruca", "Arugula"),
            li("Berenjena", "Albergínia", "Eggplant"),
            li("Brócoli", "Bròcoli", "Broccoli"),
            li("Coliflor", "Coliflor", "Cauliflower"),
            li("Espárragos", "Espàrrecs", "Asparagus"),
            li("Pepino", "Cogombre", "Cucumber"),
            li("Ajos", "Alls", "Garlic"),
            li("Espinacas", "Espinacs", "Spinach"),
            li("Judías verdes", "Mongetes verdes", "Green beans"),
            li("Champiñones", "Xampinyons", "Mushrooms"),
            li("Puerros", "Porros", "Leeks"),
            li("Calabaza", "Carbassa", "Pumpkin"),
            li("Apio", "Api", "Celery"),
            li("Rábanos", "Raves", "Radishes"),
        )),
        Category("meat", "🥩", listOf(
            li("Pollo", "Pollastre", "Chicken"),
            li("Ternera", "Vedella", "Beef"),
            li("Cerdo", "Porc", "Pork"),
            li("Cordero", "Xai", "Lamb"),
            li("Pavo", "Gall dindi", "Turkey"),
            li("Conejo", "Conill", "Rabbit"),
            li("Salchichas", "Salsitxes", "Sausages"),
            li("Bacon", "Bacon", "Bacon"),
            li("Jamón York", "Pernil dolç", "Ham"),
            li("Jamón Serrano", "Pernil serrà", "Serrano Ham"),
            li("Chorizo", "Xoriço", "Chorizo"),
            li("Lomo", "Llom", "Pork loin"),
            li("Pescado blanco", "Peix blanc", "White fish"),
            li("Salmón", "Salmó", "Salmon"),
            li("Atún fresco", "Tonyina fresca", "Fresh tuna"),
            li("Gambas", "Gambes", "Shrimp"),
            li("Mejillones", "Musclos", "Mussels"),
            li("Calamares", "Calamars", "Squid"),
            li("Bacalao", "Bacallà", "Cod"),
            li("Rape", "Rap", "Monkfish"),
            li("Carne picada", "Carn picada", "Minced meat"),
        )),
        Category("dairy", "🧀", listOf(
            li("Leche", "Llet", "Milk"),
            li("Queso", "Formatge", "Cheese"),
            li("Yogur", "Iogurt", "Yogurt"),
            li("Mantequilla", "Mantega", "Butter"),
            li("Nata", "Nata", "Cream"),
            li("Huevos", "Ous", "Eggs"),
            li("Clara 0,0", "Clara 0,0", "Egg whites"),
            li("Queso rallado", "Formatge ratllat", "Grated cheese"),
            li("Leche de avena", "Llet d'civada", "Oat milk"),
            li("Leche de soja", "Llet de soja", "Soy milk"),
            li("Margarina", "Margarina", "Margarine"),
            li("Kéfir", "Kèfir", "Kefir"),
            li("Queso crema", "Formatge crema", "Cream cheese"),
            li("Requesón", "Recuit", "Cottage cheese"),
            li("Flan", "Flam", "Flan"),
            li("Natillas", "Natilles", "Custard"),
        )),
        Category("pantry", "🍝", listOf(
            li("Pan", "Pa", "Bread"),
            li("Arroz", "Arròs", "Rice"),
            li("Pasta", "Pasta", "Pasta"),
            li("Aceite", "Oli", "Oil"),
            li("Vinagre", "Vinagre", "Vinegar"),
            li("Sal", "Sal", "Salt"),
            li("Azúcar", "Sucre", "Sugar"),
            li("Harina", "Farina", "Flour"),
            li("Café", "Cafè", "Coffee"),
            li("Té", "Te", "Tea"),
            li("Cereales", "Cereals", "Cereals"),
            li("Galletas", "Galetes", "Cookies"),
            li("Atún lata", "Tonyina llauna", "Canned tuna"),
            li("Tomate frito", "Tomàquet fregit", "Tomato sauce"),
            li("Legumbres", "Llegums", "Legumes"),
            li("Lentejas", "Llenties", "Lentils"),
            li("Garbanzos", "Cigrons", "Chickpeas"),
            li("Mermelada", "Melmelada", "Jam"),
            li("Miel", "Mel", "Honey"),
            li("Caldo", "Brou", "Broth"),
            li("Frutos secos", "Fruits secs", "Nuts"),
            li("Pan de molde", "Pa de motlle", "Sliced bread"),
        )),
        Category("cleaning", "🧼", listOf(
            li("Detergente", "Detergent", "Detergent"),
            li("Papel WC", "Paper WC", "Toilet Paper"),
            li("Suavizante", "Suavitzant", "Fabric softener"),
            li("Lavavajillas", "Rentaplats", "Dish soap"),
            li("Lejía", "Lleixiu", "Bleach"),
            li("Limpiacristales", "Netejavidres", "Glass cleaner"),
            li("Multiusos", "Multiusos", "All-purpose cleaner"),
            li("Estropajos", "Fregalls", "Scouring pads"),
            li("Bayetas", "Baietes", "Cleaning cloths"),
            li("Bolsas basura", "Bosses escombraries", "Trash bags"),
            li("Champú", "Xampú", "Shampoo"),
            li("Gel de baño", "Gel de bany", "Shower gel"),
            li("Pasta de dientes", "Pasta de dents", "Toothpaste"),
            li("Desodorante", "Desodorant", "Deodorant"),
            li("Papel cocina", "Paper cuina", "Kitchen paper"),
            li("Servilletas", "Tovallons", "Napkins"),
            li("Compresas", "Compreses", "Pads"),
            li("Pañuelos", "Mocadors", "Tissues"),
        )),
        Category("home", "🏠", listOf(
            li("Pilas", "Piles", "Batteries"),
            li("Bombillas", "Bombetes", "Light bulbs"),
            li("Papel aluminio", "Paper alumini", "Aluminum foil"),
            li("Film transparente", "Film transparent", "Plastic wrap"),
            li("Velas", "Espelmes", "Candles"),
            li("Cerillas", "Mistos", "Matches"),
            li("Cinta adhesiva", "Cinta adhesiva", "Adhesive tape"),
            li("Filtros café", "Filtres cafè", "Coffee filters"),
            li("Papel de horno", "Paper de forn", "Baking paper"),
        )),
        Category("snacks", "🍪", listOf(
            li("Chocolate", "Xocolata", "Chocolate"),
            li("Patatas Chips", "Patates Xips", "Chips"),
            li("Gominolas", "Llaminadures", "Gummy candies"),
            li("Aceitunas", "Olives", "Olives"),
            li("Palomitas", "Crispetes", "Popcorn"),
            li("Tortitas de arroz", "Tortetes d'arròs", "Rice cakes"),
            li("Barritas cereales", "Barretes cereals", "Cereal bars"),
            li("Helado", "Gelat", "Ice cream"),
            li("Bizcocho", "Pa de pessic", "Sponge cake"),
            li("Gelatina", "Gelatina", "Gelatin"),
            li("Nachos", "Nachos", "Nachos"),
        )),
        Category("frozen", "🧊", listOf(
            li("Helado", "Gelat", "Ice Cream"),
            li("Pizza congelada", "Pizza congelada", "Frozen pizza"),
            li("Guisantes congelados", "Pèsols congelats", "Frozen peas"),
            li("Patatas fritas", "Patates fregides", "French fries"),
            li("Pescado congelado", "Peix congelat", "Frozen fish"),
            li("Verdura congelada", "Verdura congelada", "Frozen vegetables"),
            li("Croquetas", "Croquetes", "Croquettes"),
            li("Canelones", "Canelons", "Cannelloni"),
        )),
        Category("processed", "🍕", listOf(
            li("Pizza Fresca", "Pizza Fresca", "Fresh Pizza"),
            li("Gazpacho", "Gaspatxo", "Gazpacho"),
            li("Hummus", "Hummus", "Hummus"),
            li("Guacamole", "Guacamole", "Guacamole"),
            li("Platos preparados", "Plats preparats", "Ready meals"),
            li("Masa de hojaldre", "Massa de full", "Puff pastry"),
            li("Masa de pizza", "Massa de pizza", "Pizza dough"),
        )),
        Category("drinks", "🍷", listOf(
            li("Agua", "Aigua", "Water"),
            li("Vino", "Vi", "Wine"),
            li("Cerveza", "Cervesa", "Beer"),
            li("Cerveza 0,0", "Cervesa 0,0", "Beer 0,0"),
            li("Garrafa Agua", "Garrafa Aigua", "Water jug"),
            li("Refrescos", "Refrescos", "Soft drinks"),
            li("Zumo", "Suc", "Juice"),
            li("Batidos", "Batuts", "Milkshakes"),
            li("Tónica", "Tònica", "Tonic water"),
            li("Cava", "Cava", "Cava"),
            li("Vermut", "Vermut", "Vermouth"),
            li("Isotónicas", "Isotòniques", "Sports drinks"),
        )),
        Category("spices", "🧂", listOf(
            li("Curry", "Curri", "Curry"),
            li("Canela", "Canyella", "Cinnamon"),
            li("Comino", "Comí", "Cumin"),
            li("Pimienta Negra", "Pebre Negre", "Black Pepper"),
            li("Orégano", "Orenga", "Oregano"),
            li("Pimentón", "Pebre vermell", "Paprika"),
            li("Tomillo", "Farigola", "Thyme"),
            li("Romero", "Romaní", "Rosemary"),
            li("Albahaca", "Alfàbrega", "Basil"),
            li("Perejil", "Julivert", "Parsley"),
            li("Sal", "Sal", "Salt"),
            li("Laurel", "Llorer", "Bay leaf"),
            li("Ajo en polvo", "All en pols", "Garlic powder"),
        )),
        Category("other", "📦", listOf(
            li("Comida gato", "Menjar gat", "Cat food"),
            li("Comida perro", "Menjar gos", "Dog food"),
            li("Arena gato", "Sorra gat", "Cat litter"),
        )),
    )

    val keys: List<String> = categories.map { it.key }
    val byKey: Map<String, Category> = categories.associateBy { it.key }

    /** Best-effort category guess for a typed name, scanning the catalog. */
    fun guessCategory(name: String): String {
        val n = name.trim().lowercase()
        if (n.isEmpty()) return "other"
        for (cat in categories) {
            for (item in cat.items) {
                if (item.es.lowercase() == n || item.ca.lowercase() == n || item.en.lowercase() == n) {
                    return cat.key
                }
            }
        }
        return "other"
    }

    val emojiList: List<String> = (
        "🍎🍏🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶🫑🌽🥕🫒🧄🧅🥔🍠" +
        "🥩🍗🍖🥓🍔🍟🍕🌭🥪🌮🌯🍳🥘🍲🥣🥗🍿🍣🍱🥟🍤🍙🍚🍜🍝" +
        "🍞🥐🥖🥨🥯🥞🧇🧀🥚🥛🍼☕🍵🧃🥤🧋🍺🍻🍷🥂🍹🍸🥃🍶🧉🧊" +
        "🍦🍧🍨🍩🍪🎂🍰🥧🧁🍫🍬🍭🍮🍯🥜🌰" +
        "🧼🧽🧹🧺🧻🧴🪥🪒🚿🛀🛁🚽🫧" +
        "🏠🛋🪑🛏🕯💡🔦🪜🪣🧯🔨🪛🔧🪚🔩⚙🧱🧲🔪" +
        "🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦆🦉🐺🐗🐴🦄🐝🐢🐍🦎🐙🦑🦐🦀🐠🐟🐬🐳🐋🦈" +
        "👕👖👗👞👟🥾👑💍💼👜🎒👓🕶☂" +
        "🎁🎈🎉🎊✉📩📧💌📦🏷📅📆📈📊📋📌📍📎✂🗑🔒🔑🛠"
    ).codePoints().toArray().map { String(Character.toChars(it)) }
}
