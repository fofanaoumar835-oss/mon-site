import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./SupabaseConfig.js";

const PRODUCT_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const configReady = SUPABASE_URL.startsWith("https://")
    && !SUPABASE_URL.includes("REMPLACER")
    && SUPABASE_ANON_KEY.length > 20
    && !SUPABASE_ANON_KEY.includes("REMPLACER");

const elements = {
    connectionStatus: document.querySelector("#connection-status"),
    productGrid: document.querySelector("#product-grid"),
    sellerOpen: document.querySelector("#seller-open"),
    sellerDialog: document.querySelector("#seller-dialog"),
    sellerDialogClose: document.querySelector("#seller-dialog-close"),
    sellerLoginForm: document.querySelector("#seller-login-form"),
    sellerLoginMessage: document.querySelector("#seller-login-message"),
    sellerPanel: document.querySelector("#seller-panel"),
    sellerLogout: document.querySelector("#seller-logout"),
    productForm: document.querySelector("#product-form"),
    productId: document.querySelector("#product-id"),
    productName: document.querySelector("#product-name"),
    productPrice: document.querySelector("#product-price"),
    productDescription: document.querySelector("#product-description"),
    productImage: document.querySelector("#product-image"),
    imageHelp: document.querySelector("#image-help"),
    productFormTitle: document.querySelector("#product-form-title"),
    productSubmit: document.querySelector("#product-submit"),
    productCancel: document.querySelector("#product-cancel"),
    productMessage: document.querySelector("#product-message"),
    sellerProductList: document.querySelector("#seller-product-list"),
    likeButton: document.querySelector("#like-button"),
    likeCount: document.querySelector("#like-count"),
    reviewForm: document.querySelector("#review-form"),
    reviewMessage: document.querySelector("#review-message"),
    reviewStatus: document.querySelector("#review-status"),
    reviewList: document.querySelector("#review-list")
};

let supabase;
let products = [];
let visitorId;
let pageIsLiked = false;

function setMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("is-error", isError);
}

function getErrorMessage(error) {
    return error && error.message ? error.message : "Une erreur inattendue s’est produite.";
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function formatPrice(price) {
    return new Intl.NumberFormat("fr-GN", {
        style: "currency",
        currency: "GNF",
        maximumFractionDigits: 0
    }).format(price);
}

function productImageUrl(path) {
    return supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl;
}

function renderProducts() {
    elements.productGrid.replaceChildren();

    if (products.length === 0) {
        elements.connectionStatus.textContent = "Les produits disponibles seront affichés ici.";
        return;
    }

    elements.connectionStatus.textContent = `${products.length} produit${products.length > 1 ? "s" : ""} disponible${products.length > 1 ? "s" : ""}.`;
    for (const product of products) {
        const card = makeElement("article", "product-card");
        const image = makeElement("img", "product-photo");
        image.src = productImageUrl(product.image_path);
        image.alt = product.name;
        image.loading = "lazy";
        image.addEventListener("error", () => {
            image.alt = `Photo indisponible pour ${product.name}`;
            image.classList.add("image-unavailable");
        }, { once: true });

        const content = makeElement("div", "product-card-content");
        const title = makeElement("h3", "product-name", product.name);
        const description = makeElement("p", "product-description", product.description || "Contactez-nous pour en savoir plus.");
        const price = makeElement("p", "product-price", formatPrice(product.price));
        const orderLink = makeElement("a", "product-order", "Commander sur WhatsApp ↗");
        const message = encodeURIComponent(`Bonjour Channel Shop, je suis intéressé(e) par le produit « ${product.name} » au prix de ${formatPrice(product.price)}.`);
        orderLink.href = `https://wa.me/224660527599?text=${message}`;
        orderLink.target = "_blank";
        orderLink.rel = "noopener noreferrer";

        content.append(title, description, price, orderLink);
        card.append(image, content);
        elements.productGrid.append(card);
    }
}

async function loadProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, image_path, created_at")
        .order("created_at", { ascending: false });

    if (error) throw error;
    products = data;
    renderProducts();
    if (!elements.sellerPanel.hidden) renderSellerProducts();
}

function renderReviews(reviews) {
    elements.reviewList.replaceChildren();
    elements.reviewStatus.textContent = reviews.length
        ? `${reviews.length} avis client${reviews.length > 1 ? "s" : ""}`
        : "Soyez le premier à partager votre avis.";

    for (const review of reviews) {
        const card = makeElement("article", "review-card");
        const heading = makeElement("div", "review-card-heading");
        const name = makeElement("h4", "", review.name);
        const stars = makeElement("span", "review-stars", `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`);
        const date = new Date(review.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
        const comment = makeElement("p", "review-comment", review.content);
        const reviewDate = makeElement("time", "review-date", date);
        reviewDate.dateTime = review.created_at;
        heading.append(name, stars);
        card.append(heading, comment, reviewDate);
        elements.reviewList.append(card);
    }
}

async function loadReviews() {
    const { data, error } = await supabase
        .from("reviews")
        .select("id, name, rating, content, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

    if (error) throw error;
    renderReviews(data);
}

async function loadLikes() {
    const [countResult, ownLikeResult] = await Promise.all([
        supabase.rpc("get_page_like_count"),
        supabase.from("page_likes").select("user_id").eq("user_id", visitorId).maybeSingle()
    ]);

    if (countResult.error) throw countResult.error;
    if (ownLikeResult.error) throw ownLikeResult.error;
    elements.likeCount.textContent = String(countResult.data || 0);
    pageIsLiked = Boolean(ownLikeResult.data);
    elements.likeButton.setAttribute("aria-pressed", String(pageIsLiked));
    elements.likeButton.querySelector("span").textContent = pageIsLiked ? "♥" : "♡";
    elements.likeButton.classList.toggle("is-liked", pageIsLiked);
    elements.likeButton.disabled = false;
}

async function checkSeller() {
    const { data, error } = await supabase.rpc("is_seller");
    if (error) throw error;
    return data === true;
}

async function syncSellerPanel() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (data.session && await checkSeller()) {
        elements.sellerPanel.hidden = false;
        await loadProducts();
        return;
    }

    elements.sellerPanel.hidden = true;
}

function renderSellerProducts() {
    elements.sellerProductList.replaceChildren();
    if (products.length === 0) {
        elements.sellerProductList.append(makeElement("p", "empty-products", "Aucun produit publié pour le moment."));
        return;
    }

    for (const product of products) {
        const row = makeElement("article", "seller-product-row");
        const image = makeElement("img", "seller-product-image");
        image.src = productImageUrl(product.image_path);
        image.alt = "";
        const details = makeElement("div", "seller-product-details");
        details.append(
            makeElement("strong", "", product.name),
            makeElement("span", "", formatPrice(product.price))
        );
        const actions = makeElement("div", "seller-product-actions");
        const edit = makeElement("button", "seller-logout", "Modifier");
        edit.type = "button";
        edit.addEventListener("click", () => startEditingProduct(product));
        const remove = makeElement("button", "seller-delete", "Supprimer");
        remove.type = "button";
        remove.addEventListener("click", () => deleteProduct(product));
        actions.append(edit, remove);
        row.append(image, details, actions);
        elements.sellerProductList.append(row);
    }
}

function startEditingProduct(product) {
    elements.productForm.reset();
    elements.productId.value = product.id;
    elements.productName.value = product.name;
    elements.productPrice.value = String(product.price);
    elements.productDescription.value = product.description || "";
    elements.productImage.required = false;
    elements.productFormTitle.textContent = "Modifier le produit";
    elements.productSubmit.textContent = "Enregistrer les modifications";
    elements.productCancel.hidden = false;
    elements.imageHelp.textContent = "Sélectionnez une nouvelle photo pour remplacer l’actuelle.";
    setMessage(elements.productMessage, "");
    elements.productForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetProductForm() {
    elements.productForm.reset();
    elements.productId.value = "";
    elements.productImage.required = true;
    elements.productFormTitle.textContent = "Ajouter un produit";
    elements.productSubmit.textContent = "Publier le produit";
    elements.productCancel.hidden = true;
    elements.imageHelp.textContent = "Image JPG, PNG ou WEBP, 5 Mo maximum.";
    setMessage(elements.productMessage, "");
}

function validateImage(file) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
        throw new Error("Choisissez une image au format JPG, PNG ou WEBP.");
    }
    if (file.size > MAX_IMAGE_SIZE) {
        throw new Error("La photo doit peser 5 Mo maximum.");
    }
}

async function uploadProductImage(file) {
    validateImage(file);
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(PRODUCT_BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
    });

    if (error) throw error;
    return path;
}

async function removeProductImage(path) {
    const { error } = await supabase.storage.from(PRODUCT_BUCKET).remove([path]);
    if (error) throw error;
}

async function saveProduct(event) {
    event.preventDefault();
    setMessage(elements.productMessage, "");
    elements.productSubmit.disabled = true;

    let uploadedPath;
    let productSaved = false;
    let warningMessage = "";
    try {
        const id = elements.productId.value;
        const imageFile = elements.productImage.files[0];
        validateImage(imageFile);
        if (!id && !imageFile) throw new Error("Ajoutez une photo pour publier le produit.");

        const price = Number(elements.productPrice.value);
        if (!Number.isFinite(price) || price < 0) throw new Error("Saisissez un prix valide.");
        const productData = {
            name: elements.productName.value.trim(),
            description: elements.productDescription.value.trim(),
            price
        };
        if (!productData.name) throw new Error("Le nom du produit est obligatoire.");

        if (imageFile) uploadedPath = await uploadProductImage(imageFile);

        if (id) {
            const existing = products.find((product) => product.id === id);
            if (!existing) throw new Error("Ce produit n’existe plus. Actualisez la page et réessayez.");
            if (uploadedPath) productData.image_path = uploadedPath;
            const { error } = await supabase.from("products").update(productData).eq("id", id);
            if (error) throw error;
            productSaved = true;

            if (uploadedPath && existing.image_path) {
                try {
                    await removeProductImage(existing.image_path);
                } catch (cleanupError) {
                    warningMessage = `L’ancienne photo n’a pas pu être supprimée : ${getErrorMessage(cleanupError)}`;
                }
            }
        } else {
            const { error } = await supabase.from("products").insert({
                ...productData,
                image_path: uploadedPath
            });
            if (error) throw error;
            productSaved = true;
        }

        resetProductForm();
        try {
            await loadProducts();
        } catch (refreshError) {
            warningMessage = `Le produit est enregistré, mais la liste n’a pas pu être actualisée : ${getErrorMessage(refreshError)}`;
        }
        setMessage(
            elements.productMessage,
            warningMessage || (id ? "Produit mis à jour." : "Produit publié avec succès."),
            Boolean(warningMessage)
        );
    } catch (error) {
        if (uploadedPath && !productSaved) {
            try {
                await removeProductImage(uploadedPath);
            } catch (cleanupError) {
                setMessage(elements.productMessage, `${getErrorMessage(error)} La nouvelle photo n’a pas pu être supprimée : ${getErrorMessage(cleanupError)}`, true);
                return;
            }
        }
        setMessage(elements.productMessage, getErrorMessage(error), true);
    } finally {
        elements.productSubmit.disabled = false;
    }
}

async function deleteProduct(product) {
    if (!window.confirm(`Supprimer « ${product.name} » ?`)) return;
    try {
        const { error } = await supabase.from("products").delete().eq("id", product.id);
        if (error) throw error;

        let cleanupMessage = "";
        try {
            await removeProductImage(product.image_path);
        } catch (error) {
            cleanupMessage = ` Le produit est supprimé, mais sa photo n’a pas pu être supprimée : ${getErrorMessage(error)}`;
        }
        try {
            await loadProducts();
        } catch (refreshError) {
            cleanupMessage += ` La liste n’a pas pu être actualisée : ${getErrorMessage(refreshError)}`;
        }
        setMessage(elements.productMessage, `Produit supprimé.${cleanupMessage}`, Boolean(cleanupMessage));
    } catch (error) {
        setMessage(elements.productMessage, getErrorMessage(error), true);
    }
}

async function submitReview(event) {
    event.preventDefault();
    setMessage(elements.reviewMessage, "");
    const submitButton = elements.reviewForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
        const formData = new FormData(elements.reviewForm);
        const { error } = await supabase.from("reviews").insert({
            name: String(formData.get("name")).trim(),
            rating: Number(formData.get("rating")),
            content: String(formData.get("content")).trim()
        });
        if (error) throw error;

        elements.reviewForm.reset();
        await loadReviews();
        setMessage(elements.reviewMessage, "Merci ! Votre avis a bien été publié.");
    } catch (error) {
        setMessage(elements.reviewMessage, getErrorMessage(error), true);
    } finally {
        submitButton.disabled = false;
    }
}

async function togglePageLike() {
    elements.likeButton.disabled = true;
    try {
        if (pageIsLiked) {
            const { error } = await supabase.from("page_likes").delete().eq("user_id", visitorId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from("page_likes").insert({ user_id: visitorId });
            if (error) throw error;
        }
        await loadLikes();
    } catch (error) {
        setMessage(elements.reviewStatus, `Impossible d’enregistrer votre like : ${getErrorMessage(error)}`, true);
        elements.likeButton.disabled = false;
    }
}

function openSellerLogin() {
    if (!configReady) {
        setMessage(elements.sellerLoginMessage, "La boutique en ligne n’est pas encore configurée. Suivez le guide SUPABASE_SETUP.md.", true);
        elements.sellerLoginForm.querySelector('button[type="submit"]').disabled = true;
    }
    elements.sellerDialog.showModal();
}

async function loginSeller(event) {
    event.preventDefault();
    setMessage(elements.sellerLoginMessage, "");
    const submitButton = elements.sellerLoginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
        const formData = new FormData(elements.sellerLoginForm);
        const { error } = await supabase.auth.signInWithPassword({
            email: String(formData.get("email")).trim(),
            password: String(formData.get("password"))
        });
        if (error) throw error;
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        visitorId = sessionData.session.user.id;
        if (!await checkSeller()) {
            await supabase.auth.signOut();
            const { data: anonymousData, error: anonymousError } = await supabase.auth.signInAnonymously();
            if (anonymousError) throw anonymousError;
            visitorId = anonymousData.user.id;
            throw new Error("Ce compte n’a pas l’autorisation de gérer la boutique.");
        }

        elements.sellerDialog.close();
        elements.sellerLoginForm.reset();
        elements.sellerPanel.hidden = false;
        await loadProducts();
        elements.sellerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        setMessage(elements.sellerLoginMessage, getErrorMessage(error), true);
    } finally {
        submitButton.disabled = false;
    }
}

async function logoutSeller() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        setMessage(elements.productMessage, getErrorMessage(error), true);
        return;
    }
    const { data, error: anonymousError } = await supabase.auth.signInAnonymously();
    if (anonymousError) {
        setMessage(elements.productMessage, `Déconnexion effectuée, mais la session visiteur n’a pas pu être créée : ${getErrorMessage(anonymousError)}`, true);
        elements.sellerPanel.hidden = true;
        return;
    }
    visitorId = data.user.id;
    elements.sellerPanel.hidden = true;
    resetProductForm();
    try {
        await loadLikes();
    } catch (loadError) {
        setMessage(elements.productMessage, `Déconnexion effectuée, mais les likes n’ont pas pu être actualisés : ${getErrorMessage(loadError)}`, true);
    }
}

async function initialize() {
    if (!configReady) {
        elements.connectionStatus.textContent = "La boutique en ligne n’est pas encore configurée.";
        elements.reviewStatus.textContent = "Les avis en ligne seront disponibles après la configuration.";
        elements.likeButton.disabled = true;
        elements.reviewForm.querySelectorAll("input, select, textarea, button").forEach((input) => { input.disabled = true; });
        return;
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    elements.likeButton.disabled = true;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        visitorId = data.user.id;
    } else {
        visitorId = sessionData.session.user.id;
    }

    const initialLoads = [
        loadProducts().catch((error) => {
            elements.connectionStatus.textContent = `Impossible de charger les produits : ${getErrorMessage(error)}`;
            elements.connectionStatus.classList.add("is-error");
        }),
        loadReviews().catch((error) => {
            elements.reviewStatus.textContent = `Impossible de charger les avis : ${getErrorMessage(error)}`;
            elements.reviewStatus.classList.add("is-error");
        }),
        loadLikes().catch((error) => {
            elements.reviewStatus.textContent = `Impossible de charger les likes : ${getErrorMessage(error)}`;
            elements.reviewStatus.classList.add("is-error");
        }),
        syncSellerPanel().catch((error) => {
            console.error("Échec du chargement de l’espace vendeur.", error);
        })
    ];
    await Promise.all(initialLoads);
}

elements.sellerOpen.addEventListener("click", openSellerLogin);
elements.sellerDialogClose.addEventListener("click", () => elements.sellerDialog.close());
elements.sellerLoginForm.addEventListener("submit", (event) => {
    if (!supabase) {
        event.preventDefault();
        return;
    }
    loginSeller(event);
});
elements.productForm.addEventListener("submit", saveProduct);
elements.productCancel.addEventListener("click", resetProductForm);
elements.sellerLogout.addEventListener("click", logoutSeller);
elements.reviewForm.addEventListener("submit", submitReview);
elements.likeButton.addEventListener("click", togglePageLike);
elements.productImage.addEventListener("change", () => {
    try {
        validateImage(elements.productImage.files[0]);
        setMessage(elements.productMessage, "");
    } catch (error) {
        elements.productImage.value = "";
        setMessage(elements.productMessage, getErrorMessage(error), true);
    }
});

initialize().catch((error) => {
    elements.connectionStatus.textContent = `Erreur de configuration : ${getErrorMessage(error)}`;
    elements.connectionStatus.classList.add("is-error");
    elements.reviewStatus.textContent = "Les avis ne sont pas disponibles pour le moment.";
    elements.reviewStatus.classList.add("is-error");
});
